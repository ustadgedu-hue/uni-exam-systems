// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE CONTROLLER - Past papers aur course materials
// ═══════════════════════════════════════════════════════════════════════════
//
// Files ab local disk pe nahi, Cloudinary pe store hoti hain.
//
// Upload 3 qadam mein hota hai:
//   1. Frontend signature mangti hai        → getUploadSignature
//   2. Browser file SEEDHA Cloudinary bhejta hai (backend ke through nahi)
//   3. Frontend upload ki tafseel backend ko bhejti hai → uploadResource
//
// Qadam 2 seedha kyun? Kyunki Vercel ki serverless function 4.5MB se bari
// request body qubool nahi karti. Seedha bhejne se 20MB tak file chalti hai.
//
// Qadam 3 mein backend Cloudinary se KHUD tasdeeq karta hai ke file waqai
// mojood hai — warna koi bhi apni marzi ka URL bhej kar use "past paper" bana
// sakta tha.
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const path = require('path');

const Resource = require('../models/Resource');
const Course = require('../models/Course');
const {
  cloudinary, isConfigured,
  RESOURCE_TYPE, DELIVERY_TYPE, DOWNLOAD_URL_TTL, UPLOAD_FOLDER
} = require('../config/cloudinary');

const MAX_FILE_BYTES = 20 * 1024 * 1024;   // 20MB
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

// Cloudinary set nahi hai to resource routes saaf mana kar dein
const requireCloudinary = (res) => {
  if (isConfigured()) return true;
  res.status(503).json({
    message: 'File storage is not configured. Set CLOUDINARY_* environment variables.'
  });
  return false;
};

// ───────────────────────────────────────────────────────────────────────────
// POST /api/resources/signature   (instructor/admin)
// Browser ko seedha Cloudinary pe upload karne ki ijazat deta hai
// ───────────────────────────────────────────────────────────────────────────
const getUploadSignature = async (req, res) => {
  try {
    if (!requireCloudinary(res)) return;

    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ message: 'fileName is required' });

    const ext = path.extname(fileName).replace('.', '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ message: 'Only PDF, JPG, PNG files are allowed' });
    }

    // public_id HUM banate hain, client nahi. Isliye client kisi doosri
    // already-uploaded file ka naam le kar use apna nahi keh sakta.
    const publicId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = Math.round(Date.now() / 1000);

    // Signature sirf inhi parameters pe hai — Cloudinary in ke ilawa kuch
    // badla hua qubool nahi karega. 'type' bhi sign hota hai taake client
    // file ko 'private' ke bajaye 'public' bana kar upload na kar sake.
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: UPLOAD_FOLDER, public_id: publicId, type: DELIVERY_TYPE },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      publicId,
      folder: UPLOAD_FOLDER,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      resourceType: RESOURCE_TYPE,
      deliveryType: DELIVERY_TYPE,
      maxBytes: MAX_FILE_BYTES
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// POST /api/resources/upload   (instructor/admin)
// Cloudinary pe upload ho chukne ke BAAD metadata save karta hai
// ───────────────────────────────────────────────────────────────────────────
const uploadResource = async (req, res) => {
  try {
    if (!requireCloudinary(res)) return;

    const { title, description, type, courseId, year, semester,
            publicId, cloudinaryPublicId, fileName } = req.body;

    if (!publicId) return res.status(400).json({ message: 'publicId is required' });
    if (!title)    return res.status(400).json({ message: 'title is required' });
    if (!fileName) return res.status(400).json({ message: 'fileName is required' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // ── Kaunsa public_id dekhein? ────────────────────────────────────────
    // 'raw' uploads mein Cloudinary hamare diye hue public_id ke aakhir mein
    // file extension khud laga deta hai:
    //     hum ne signed kiya : exam_system/resources/1699-ab12
    //     Cloudinary ne rakha : exam_system/resources/1699-ab12.pdf
    //
    // Isliye client wapas bhejta hai ke Cloudinary ne kya naam rakha. Lekin
    // hum us par aankh band kar ke bharosa nahi karte — sirf wahi qubool hai
    // jo HAMARE signed id se shuru ho aur uske baad sirf ek extension ho.
    // Is tarah client kisi doosri file ki taraf ishara nahi kar sakta.
    const expectedPrefix = `${UPLOAD_FOLDER}/${publicId}`;
    const claimedId = cloudinaryPublicId || expectedPrefix;

    const suffix = claimedId.slice(expectedPrefix.length);
    const isExactMatch = claimedId === expectedPrefix;
    const isExtensionMatch = claimedId.startsWith(expectedPrefix) && /^\.[a-zA-Z0-9]+$/.test(suffix);

    if (!isExactMatch && !isExtensionMatch) {
      return res.status(400).json({ message: 'Upload identifier does not match the signed upload' });
    }

    // ✅ TASDEEQ: file waqai Cloudinary pe mojood hai?
    // Iske bagair client koi bhi URL bhej kar student ko kahin bhi bhej sakta tha.
    let asset;
    try {
      asset = await cloudinary.api.resource(claimedId, {
        resource_type: RESOURCE_TYPE,
        type: DELIVERY_TYPE
      });
    } catch (err) {
      return res.status(400).json({
        message: 'Upload could not be verified with Cloudinary. Please try uploading again.'
      });
    }

    const destroy = (publicIdToDestroy) => cloudinary.uploader.destroy(publicIdToDestroy, {
      resource_type: RESOURCE_TYPE,
      type: DELIVERY_TYPE
    });

    if (asset.bytes > MAX_FILE_BYTES) {
      // Signature se bach kar bari file chali gayi — hata do
      await destroy(asset.public_id);
      return res.status(400).json({ message: 'File is larger than the 20MB limit' });
    }

    const ext = path.extname(fileName).replace('.', '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      await destroy(asset.public_id);
      return res.status(400).json({ message: 'Only PDF, JPG, PNG files are allowed' });
    }

    const resource = await Resource.create({
      title,
      description,
      type,
      course: courseId,
      courseCode: course.courseCode,
      courseName: course.courseName,
      uploadedBy: req.user._id,
      fileName,
      // Sirf public_id save hota hai. Download ka URL har baar naya banta hai
      // (kyunki signed link thori der baad khatam ho jata hai), isliye use
      // database mein rakhna bekaar aur ghalat-fehmi ka baais hota.
      publicId: asset.public_id,
      fileType: ext,
      fileSize: asset.bytes,
      year: year ? parseInt(year) : null,
      semester
    });

    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /api/resources/search
// ───────────────────────────────────────────────────────────────────────────
const searchResources = async (req, res) => {
  try {
    const { query, type } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (query) {
      // User ka likha hua text regex mein ja raha hai — special characters
      // escape karo warna "(" jaisa input regex crash kar deta hai
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { courseCode: { $regex: safe, $options: 'i' } },
        { courseName: { $regex: safe, $options: 'i' } },
        { title:      { $regex: safe, $options: 'i' } }
      ];
    }
    const resources = await Resource.find(filter)
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(resources);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /api/resources/:id/download
// File backend se stream nahi hoti (Vercel ki 4.5MB response limit hai).
// Uske bajaye hum ek signed link banate hain jo 5 minute mein khatam ho jata
// hai — aur wo sirf usi user ko milta hai jo logged in ho.
// ───────────────────────────────────────────────────────────────────────────
const downloadResource = async (req, res) => {
  try {
    if (!requireCloudinary(res)) return;

    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    const url = cloudinary.utils.private_download_url(resource.publicId, '', {
      resource_type: RESOURCE_TYPE,
      type: DELIVERY_TYPE,
      expires_at: Math.round(Date.now() / 1000) + DOWNLOAD_URL_TTL,
      attachment: true      // browser file save kare, tab mein khole nahi
    });

    resource.downloadCount += 1;
    await resource.save();

    res.json({ url, fileName: resource.fileName, expiresInSeconds: DOWNLOAD_URL_TTL });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /api/resources/my   (instructor/admin)
// ───────────────────────────────────────────────────────────────────────────
const getMyResources = async (req, res) => {
  try {
    const resources = await Resource.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(resources);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// DELETE /api/resources/:id   (uploader ya admin)
// ───────────────────────────────────────────────────────────────────────────
const deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    if (resource.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Cloudinary se file hatao. Agar ye fail ho to bhi DB record hata do —
    // warna user ko ek aisa resource dikhta rahega jise wo delete nahi kar sakta.
    if (isConfigured() && resource.publicId) {
      try {
        await cloudinary.uploader.destroy(resource.publicId, {
          resource_type: RESOURCE_TYPE,
          type: DELIVERY_TYPE
        });
      } catch (err) {
        console.error('⚠️  Cloudinary delete failed (orphan file left behind):', err.message);
      }
    }

    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getUploadSignature,
  uploadResource,
  searchResources,
  downloadResource,
  getMyResources,
  deleteResource
};

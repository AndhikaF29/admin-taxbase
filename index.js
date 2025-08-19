const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();

// Solusi CSP untuk Base64 Image (letakkan sebelum routes)
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;"
  );
  next();
});

// Supabase configuration - gunakan environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://tqcjtvpnexjigmsqscfy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2p0dnBuZXhqaWdtc3FzY2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTExNzUsImV4cCI6MjA3MTE2NzE3NX0.8pToqRUB3e4ZotxE2Lc8Vj9AN87b1sIX5rLLHJO4kek';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Multer configuration for memory storage (tidak pakai disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to generate slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Routes

// Dashboard - List all news
app.get('/', async (req, res) => {
  try {
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.render('dashboard', { news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create news form
app.get('/create', (req, res) => {
  res.render('create');
});

// Create news
app.post('/create', upload.single('image'), async (req, res) => {
  try {
    const {
      judul, penulis, isi, excerpt, kategori, tags, status, featured,
      meta_title, meta_description, image_alt
    } = req.body;
    
    let imageUrl = null;
    
    // Upload image if provided - gunakan buffer langsung
    if (req.file) {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('news')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('news')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrl;
    }
    
    const slug = generateSlug(judul);
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
    
    const newsData = {
      judul,
      slug,
      penulis,
      isi,
      excerpt,
      image: imageUrl,
      image_alt,
      kategori: kategori || 'News',
      tags: tagsArray,
      status: status || 'draft',
      featured: featured === 'on',
      meta_title,
      meta_description,
      reading_time: isi ? Math.ceil(isi.split(' ').length / 200) : 0
    };
    
    if (status === 'published') {
      newsData.published_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('news')
      .insert([newsData])
      .select();
    
    if (error) throw error;
    
    res.redirect('/');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit news form
app.get('/edit/:id', async (req, res) => {
  try {
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    
    res.render('edit', { news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update news
app.post('/edit/:id', upload.single('image'), async (req, res) => {
  try {
    const {
      judul, penulis, isi, excerpt, kategori, tags, status, featured,
      meta_title, meta_description, image_alt, remove_image
    } = req.body;
    
    // Get existing news
    const { data: existingNews, error: fetchError } = await supabase
      .from('news')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;
    
    let imageUrl = existingNews.image;
    
    // Handle image removal
    if (remove_image === 'on' && existingNews.image) {
      const imagePath = existingNews.image.split('/').pop();
      await supabase.storage.from('news').remove([imagePath]);
      imageUrl = null;
    }
    
    // Upload new image if provided - gunakan buffer
    if (req.file) {
      // Remove old image if exists
      if (existingNews.image && !remove_image) {
        const oldImagePath = existingNews.image.split('/').pop();
        await supabase.storage.from('news').remove([oldImagePath]);
      }
      
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('news')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('news')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrl;
    }
    
    const slug = generateSlug(judul);
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
    
    const newsData = {
      judul,
      slug,
      penulis,
      isi,
      excerpt,
      image: imageUrl,
      image_alt,
      kategori: kategori || 'News',
      tags: tagsArray,
      status: status || 'draft',
      featured: featured === 'on',
      meta_title,
      meta_description,
      reading_time: isi ? Math.ceil(isi.split(' ').length / 200) : 0
    };
    
    // Set published_at if changing to published
    if (status === 'published' && existingNews.status !== 'published') {
      newsData.published_at = new Date().toISOString();
    } else if (status !== 'published') {
      newsData.published_at = null;
    }
    
    const { data, error } = await supabase
      .from('news')
      .update(newsData)
      .eq('id', req.params.id)
      .select();
    
    if (error) throw error;
    
    res.redirect('/');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete news
app.delete('/delete/:id', async (req, res) => {
  try {
    // Get news to delete associated image
    const { data: news, error: fetchError } = await supabase
      .from('news')
      .select('image')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Delete image from storage if exists
    if (news.image) {
      const imagePath = news.image.split('/').pop();
      await supabase.storage.from('news').remove([imagePath]);
    }
    
    // Delete news record
    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get news data
app.get('/api/news', async (req, res) => {
  try {
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get single news
app.get('/api/news/:id', async (req, res) => {
  try {
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler agar error EJS lebih jelas di log Vercel
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error: ' + err.message);
});

// Export untuk Vercel
module.exports = app;

// Hanya jalankan app.listen() jika tidak di Vercel
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Admin News app listening at http://localhost:${port}`);
  });
}

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

// Ensure directories exist
for (const dir of [PUBLIC_DIR, DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Simple JSON helpers
function readJson(file, defaultValue) {
  try {
    const fullPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(fullPath)) return defaultValue;
    const text = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(text || 'null') ?? defaultValue;
  } catch (e) {
    console.error('Failed to read JSON', file, e);
    return defaultValue;
  }
}

function writeJson(file, value) {
  const fullPath = path.join(DATA_DIR, file);
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2), 'utf8');
}

// Default data
if (!fs.existsSync(path.join(DATA_DIR, 'events.json'))) {
  writeJson('events.json', []);
}
if (!fs.existsSync(path.join(DATA_DIR, 'news.json'))) {
  writeJson('news.json', []);
}
if (!fs.existsSync(path.join(DATA_DIR, 'home.json'))) {
  writeJson('home.json', {
    heroImage: '',
  });
}

// View engine / static
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(PUBLIC_DIR));

// Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({ storage });

// -----------------------------
// Public site
// -----------------------------

app.get('/', (req, res) => {
  const events = readJson('events.json', []);
  const news = readJson('news.json', []);
  const home = readJson('home.json', { heroImage: '' });

  // 最新順ソート
  events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  news.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  res.render('index', {
    events,
    news,
    home,
  });
});

// -----------------------------
// Admin pages
// -----------------------------

app.get('/admin', (req, res) => {
  const events = readJson('events.json', []);
  const news = readJson('news.json', []);
  const home = readJson('home.json', { heroImage: '' });
  res.render('admin', {
    events,
    news,
    home,
  });
});

// イベント登録
app.post('/admin/events', upload.single('thumbnail'), (req, res) => {
  const events = readJson('events.json', []);
  const { title, summary, date, url } = req.body;

  const event = {
    id: Date.now().toString(),
    title: title || '',
    summary: summary || '',
    date: date || '',
    url: url || '',
    thumbnail: req.file ? `/public/uploads/${req.file.filename}` : '',
  };

  events.push(event);
  writeJson('events.json', events);
  res.redirect('/admin#events');
});

// イベント編集
app.post('/admin/events/:id/update', upload.single('thumbnail'), (req, res) => {
  const events = readJson('events.json', []);
  const { id } = req.params;
  const { title, summary, date, url } = req.body;

  const index = events.findIndex((e) => e.id === id);
  if (index === -1) {
    return res.redirect('/admin#events');
  }

  const current = events[index];

  events[index] = {
    ...current,
    title: title || '',
    summary: summary || '',
    date: date || '',
    url: url || '',
    thumbnail: req.file
      ? `/public/uploads/${req.file.filename}`
      : current.thumbnail || '',
  };

  writeJson('events.json', events);
  res.redirect('/admin#events');
});

// イベント削除
app.post('/admin/events/:id/delete', (req, res) => {
  const events = readJson('events.json', []);
  const { id } = req.params;

  const filtered = events.filter((e) => e.id !== id);
  writeJson('events.json', filtered);
  res.redirect('/admin#events');
});

// トップ画像アップロード
app.post('/admin/home-image', upload.single('heroImage'), (req, res) => {
  const home = readJson('home.json', { heroImage: '' });
  if (req.file) {
    home.heroImage = `/public/uploads/${req.file.filename}`;
    writeJson('home.json', home);
  }
  res.redirect('/admin#home');
});

// お知らせ登録
app.post('/admin/news', (req, res) => {
  const news = readJson('news.json', []);
  const { title, summary, publishedAt } = req.body;

  const item = {
    id: Date.now().toString(),
    title: title || '',
    summary: summary || '',
    publishedAt: publishedAt || '',
  };

  news.push(item);
  writeJson('news.json', news);
  res.redirect('/admin#news');
});

// お知らせ編集
app.post('/admin/news/:id/update', (req, res) => {
  const news = readJson('news.json', []);
  const { id } = req.params;
  const { title, summary, publishedAt } = req.body;

  const index = news.findIndex((n) => n.id === id);
  if (index === -1) {
    return res.redirect('/admin#news');
  }

  news[index] = {
    ...news[index],
    title: title || '',
    summary: summary || '',
    publishedAt: publishedAt || '',
  };

  writeJson('news.json', news);
  res.redirect('/admin#news');
});

// お知らせ削除
app.post('/admin/news/:id/delete', (req, res) => {
  const news = readJson('news.json', []);
  const { id } = req.params;
  const filtered = news.filter((n) => n.id !== id);
  writeJson('news.json', filtered);
  res.redirect('/admin#news');
});

// トップ画像削除
app.post('/admin/home-image/delete', (req, res) => {
  const home = readJson('home.json', { heroImage: '' });
  home.heroImage = '';
  writeJson('home.json', home);
  res.redirect('/admin#home');
});

// -----------------------------
// Start server
// -----------------------------

app.listen(PORT, () => {
  console.log(`Koi-Kukuri Meta-Life site running at http://localhost:${PORT}`);
});



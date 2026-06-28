const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;
const SESSION_SECRET = process.env.SESSION_SECRET || 'xiaoju-cat-secret-change-me';

// ============================================================
// 中间件
// ============================================================

// 请求体解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 小时
    httpOnly: true
  }
}));

// 静态文件
app.use(express.static(__dirname));

// 上传目录
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// ============================================================
// Multer 配置
// ============================================================
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 10000);
    cb(null, name + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('仅支持 JPG、PNG、GIF、WebP、SVG 格式的图片'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ============================================================
// 认证中间件
// ============================================================
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: '未登录' });
}

// ============================================================
// 公开 API
// ============================================================

// 网站配置
app.get('/api/site-config', (req, res) => {
  res.json(db.getSiteConfig());
});

// 猫咪档案
app.get('/api/profile', (req, res) => {
  const profile = db.getProfile();
  if (!profile) return res.status(404).json({ error: '档案不存在' });
  res.json(profile);
});

// 萌照墙
app.get('/api/gallery', (req, res) => {
  res.json(db.getGallery());
});

// 每日作息
app.get('/api/schedule', (req, res) => {
  res.json(db.getSchedule());
});

// 留言 — 获取可见列表
app.get('/api/messages', (req, res) => {
  res.json(db.getVisibleMessages());
});

// 留言 — 提交
app.post('/api/messages', (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: '名字和留言内容不能为空' });
  }
  if (name.length > 50 || message.length > 1000) {
    return res.status(400).json({ error: '名字最多50字，留言最多1000字' });
  }
  const msg = db.addMessage(name.trim(), message.trim());
  res.status(201).json(msg);
});

// ============================================================
// 管理 API — 认证相关
// ============================================================

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const admin = db.getAdminByUsername(username);
  if (!admin) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (!bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  res.json({ success: true, username: admin.username });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/admin/check', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ loggedIn: true, username: req.session.adminUsername });
  } else {
    res.json({ loggedIn: false });
  }
});

// ============================================================
// 管理 API — 仪表盘
// ============================================================
app.get('/admin/stats', requireAuth, (req, res) => {
  res.json(db.getStats());
});

// ============================================================
// 管理 API — 网站配置
// ============================================================
app.put('/admin/site-config', requireAuth, (req, res) => {
  const config = db.updateSiteConfig(req.body);
  res.json(config);
});

// ============================================================
// 管理 API — 猫咪档案
// ============================================================
app.put('/admin/profile', requireAuth, upload.single('avatar'), (req, res) => {
  const data = { ...req.body };

  // 如果有上传头像，替换路径
  if (req.file) {
    data.avatar = '/uploads/' + req.file.filename;
  }

  const profile = db.updateProfile(data);
  res.json(profile);
});

// ============================================================
// 管理 API — 萌照墙
// ============================================================
app.get('/admin/gallery', requireAuth, (req, res) => {
  res.json(db.getGallery());
});

app.post('/admin/gallery', requireAuth, upload.single('image'), (req, res) => {
  const data = { ...req.body };
  if (!data.title) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  if (req.file) {
    data.image = '/uploads/' + req.file.filename;
  }
  const item = db.addGalleryItem(data);
  res.status(201).json(item);
});

app.put('/admin/gallery/:id', requireAuth, upload.single('image'), (req, res) => {
  const data = { ...req.body };
  if (req.file) {
    data.image = '/uploads/' + req.file.filename;
  }
  const item = db.updateGalleryItem(req.params.id, data);
  if (!item) return res.status(404).json({ error: '记录不存在' });
  res.json(item);
});

app.delete('/admin/gallery/:id', requireAuth, (req, res) => {
  const ok = db.deleteGalleryItem(req.params.id);
  if (!ok) return res.status(404).json({ error: '记录不存在' });
  res.json({ success: true });
});

// ============================================================
// 管理 API — 每日作息
// ============================================================
app.get('/admin/schedule', requireAuth, (req, res) => {
  res.json(db.getSchedule());
});

app.post('/admin/schedule', requireAuth, (req, res) => {
  const { time_label, activity } = req.body;
  if (!time_label || !activity) {
    return res.status(400).json({ error: '时间标签和活动描述不能为空' });
  }
  const item = db.addScheduleItem({ time_label, activity });
  res.status(201).json(item);
});

app.put('/admin/schedule/:id', requireAuth, (req, res) => {
  const item = db.updateScheduleItem(req.params.id, req.body);
  if (!item) return res.status(404).json({ error: '记录不存在' });
  res.json(item);
});

app.delete('/admin/schedule/:id', requireAuth, (req, res) => {
  const ok = db.deleteScheduleItem(req.params.id);
  if (!ok) return res.status(404).json({ error: '记录不存在' });
  res.json({ success: true });
});

// ============================================================
// 管理 API — 留言
// ============================================================
app.get('/admin/messages', requireAuth, (req, res) => {
  res.json(db.getAllMessages());
});

app.put('/admin/messages/:id', requireAuth, (req, res) => {
  const msg = db.toggleMessageVisibility(req.params.id);
  if (!msg) return res.status(404).json({ error: '记录不存在' });
  res.json(msg);
});

app.delete('/admin/messages/:id', requireAuth, (req, res) => {
  const ok = db.deleteMessage(req.params.id);
  if (!ok) return res.status(404).json({ error: '记录不存在' });
  res.json({ success: true });
});

// ============================================================
// 启动
// ============================================================
app.listen(PORT, () => {
  console.log(`🐱 小橘的主页运行在 http://localhost:${PORT}`);
  console.log(`   管理后台: http://localhost:${PORT}/admin.html`);
});

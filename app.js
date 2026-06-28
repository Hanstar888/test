// ============================================================
// 页面加载 — 并发获取所有数据
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [config, profile, gallery, schedule, messages] = await Promise.all([
      fetch('/api/site-config').then(r => r.json()),
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/gallery').then(r => r.json()),
      fetch('/api/schedule').then(r => r.json()),
      fetch('/api/messages').then(r => r.json())
    ]);

    renderHero(config);
    renderProfile(profile);
    renderGallery(gallery);
    renderSchedule(schedule);
    renderMessages(messages);
    renderFooter(config);
  } catch (err) {
    console.error('页面数据加载失败:', err);
  }
});

// ============================================================
// 渲染函数
// ============================================================

function renderHero(config) {
  document.getElementById('heroTitle').textContent = config.hero_title || '🐱 欢迎';
  document.getElementById('heroSubtitle').textContent = config.hero_subtitle || '';
}

function renderProfile(profile) {
  if (!profile) return;
  document.getElementById('petName').textContent = profile.name;
  document.getElementById('avatarImg').src = profile.avatar || 'https://placekitten.com/300/300';
  document.getElementById('avatarImg').alt = profile.name;

  const info = document.getElementById('petInfo');
  info.innerHTML = '';
  const fields = [
    { label: '品种：', value: profile.breed },
    { label: '年龄：', value: profile.age },
    { label: '性别：', value: profile.gender },
    { label: '爱好：', value: profile.hobbies }
  ];
  for (const f of fields) {
    if (f.value) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${f.label}</span>${escapeHtml(f.value)}`;
      info.appendChild(li);
    }
  }
}

function renderGallery(items) {
  const grid = document.getElementById('photoGrid');
  if (!items || items.length === 0) {
    grid.innerHTML = '<p>还没有照片哦~</p>';
    return;
  }
  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'photo-card';

    if (item.image) {
      // 有真实图片
      card.innerHTML = `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" style="width:100%;height:120px;object-fit:cover;border-radius:12px;margin-bottom:8px;"><p>${escapeHtml(item.title)}</p>`;
    } else {
      card.innerHTML = `<div class="emoji">${escapeHtml(item.emoji || '📷')}</div><p>${escapeHtml(item.title)}</p>`;
    }
    grid.appendChild(card);
  }
}

function renderSchedule(items) {
  const timeline = document.getElementById('timeline');
  if (!items || items.length === 0) {
    timeline.innerHTML = '<p>暂无作息安排</p>';
    return;
  }
  timeline.innerHTML = '';
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<strong>${escapeHtml(item.time_label)}</strong> ${escapeHtml(item.activity)}`;
    timeline.appendChild(div);
  }
}

function renderMessages(items) {
  const container = document.getElementById('messages');
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#a1887f;">还没有留言，来第一个留言吧~</p>';
    return;
  }
  container.innerHTML = '';
  for (const msg of items) {
    const div = document.createElement('div');
    div.className = 'msg-item';
    const time = msg.created_at ? msg.created_at.slice(11, 16) : '';
    div.innerHTML = `<strong>${escapeHtml(msg.name)}</strong> 说：${escapeHtml(msg.message)} <small>${time}</small>`;
    container.appendChild(div);
  }
}

function renderFooter(config) {
  document.getElementById('footerText').textContent = config.footer_text || '';
}

// ============================================================
// 留言提交
// ============================================================
const form = document.getElementById('msgForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const message = document.getElementById('message').value.trim();
  if (!name || !message) return;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || '提交失败');
      return;
    }

    form.reset();

    // 刷新留言列表
    const messages = await fetch('/api/messages').then(r => r.json());
    renderMessages(messages);
  } catch (err) {
    console.error('留言提交失败:', err);
    alert('网络错误，请稍后再试');
  }
});

// ============================================================
// 工具函数
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

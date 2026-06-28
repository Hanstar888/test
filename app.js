const form = document.getElementById('msgForm');
const list = document.getElementById('messages');

// 加载已有留言
const saved = JSON.parse(localStorage.getItem('catMessages') || '[]');
saved.forEach(msg => addMessage(msg.name, msg.text, msg.time));

form.addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const text = document.getElementById('message').value.trim();
  if (!name || !text) return;

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // 存储
  const msgs = JSON.parse(localStorage.getItem('catMessages') || '[]');
  msgs.unshift({ name, text, time });
  localStorage.setItem('catMessages', JSON.stringify(msgs));

  addMessage(name, text, time);
  form.reset();
});

function addMessage(name, text, time) {
  const item = document.createElement('div');
  item.className = 'msg-item';
  item.innerHTML = `<strong>${escapeHtml(name)}</strong> 说：${escapeHtml(text)} <small>${time}</small>`;
  list.prepend(item);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

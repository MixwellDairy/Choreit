const STORAGE_KEY = 'choreit.v1';
const ME = 'You';
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const POINTS_PER_CHORE = 10;
const POINTS_PER_STREAK_DAY = 5;

const initialState = {
  chores: [],
  history: [],
  feed: [
    {
      id: crypto.randomUUID(),
      author: 'Choreit Bot',
      text: 'Welcome! Post your wins and cheer on your household.',
      visibility: 'household',
      createdAt: Date.now(),
      likes: 0,
      comments: []
    }
  ]
};

const state = loadState();

const choreForm = document.getElementById('chore-form');
const choreTitle = document.getElementById('chore-title');
const chorePriority = document.getElementById('chore-priority');
const postForm = document.getElementById('post-form');
const postText = document.getElementById('post-text');
const postVisibility = document.getElementById('post-visibility');
const highList = document.getElementById('high-list');
const mediumList = document.getElementById('medium-list');
const lowList = document.getElementById('low-list');
const historyList = document.getElementById('history-list');
const feedList = document.getElementById('feed-list');
const badgeList = document.getElementById('badge-list');
const leaderboardList = document.getElementById('leaderboard-list');
const encouragement = document.getElementById('encouragement');

choreForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = choreTitle.value.trim();
  if (!title) return;
  state.chores.unshift({
    id: crypto.randomUUID(),
    title,
    priority: chorePriority.value,
    createdAt: Date.now()
  });
  choreForm.reset();
  chorePriority.value = 'medium';
  persistAndRender();
});

postForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = postText.value.trim();
  if (!text) return;
  state.feed.unshift({
    id: crypto.randomUUID(),
    author: ME,
    text,
    visibility: postVisibility.value,
    createdAt: Date.now(),
    likes: 0,
    comments: []
  });
  postForm.reset();
  postVisibility.value = 'household';
  persistAndRender();
});

document.querySelectorAll('.quick').forEach((button) => {
  button.addEventListener('click', () => {
    completeChore(button.dataset.quick, 'high', true);
  });
});

function completeChore(title, priority, fromQuickAction = false) {
  const now = Date.now();
  state.history.unshift({
    id: crypto.randomUUID(),
    title,
    priority,
    createdAt: now,
    by: ME
  });

  state.feed.unshift({
    id: crypto.randomUUID(),
    author: ME,
    text: fromQuickAction ? `✅ ${title}` : `Completed: ${title}`,
    visibility: 'household',
    createdAt: now,
    likes: 0,
    comments: []
  });

  if (fromQuickAction) {
    state.feed.unshift({
      id: crypto.randomUUID(),
      author: 'Choreit Bot',
      text: `🎉 Celebration post: ${ME} just finished ${title.toLowerCase()}!`,
      visibility: 'public',
      createdAt: now,
      likes: 0,
      comments: []
    });
  }

  persistAndRender();
}

function renderChores() {
  const groups = {
    high: highList,
    medium: mediumList,
    low: lowList
  };

  Object.values(groups).forEach((list) => {
    list.innerHTML = '';
  });

  if (!state.chores.length) {
    highList.innerHTML = '<li class="item">No chores yet.</li>';
    mediumList.innerHTML = '<li class="item">No chores yet.</li>';
    lowList.innerHTML = '<li class="item">No chores yet.</li>';
    return;
  }

  const template = document.getElementById('chore-item-template');

  state.chores.forEach((chore) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.item-title').textContent = chore.title;

    fragment.querySelector('.complete').addEventListener('click', () => {
      state.chores = state.chores.filter((c) => c.id !== chore.id);
      completeChore(chore.title, chore.priority);
    });

    fragment.querySelector('.delete').addEventListener('click', () => {
      state.chores = state.chores.filter((c) => c.id !== chore.id);
      persistAndRender();
    });

    groups[chore.priority].appendChild(fragment);
  });
}

function renderProgress() {
  historyList.innerHTML = '';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startToday - 6 * MILLISECONDS_IN_DAY;

  const today = state.history.filter((h) => h.createdAt >= startToday).length;
  const week = state.history.filter((h) => h.createdAt >= sevenDaysAgo).length;

  document.getElementById('today-count').textContent = String(today);
  document.getElementById('week-count').textContent = String(week);
  document.getElementById('streak-count').textContent = String(getStreak());

  const toShow = state.history.slice(0, 8);
  if (!toShow.length) {
    historyList.innerHTML = '<li class="item">No completed chores yet.</li>';
    return;
  }

  toShow.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.textContent = `${entry.title} • ${new Date(entry.createdAt).toLocaleString()}`;
    historyList.appendChild(li);
  });
}

function renderFeed() {
  feedList.innerHTML = '';

  const template = document.getElementById('feed-item-template');
  const toShow = state.feed.slice(0, 20);

  toShow.forEach((post) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.feed-meta').textContent = `${post.author} • ${post.visibility} • ${new Date(post.createdAt).toLocaleString()}`;
    fragment.querySelector('.feed-text').textContent = post.text;
    fragment.querySelector('.likes').textContent = String(post.likes);

    fragment.querySelector('.like').addEventListener('click', () => {
      const target = state.feed.find((item) => item.id === post.id);
      target.likes += 1;
      persistAndRender();
    });

    const commentForm = fragment.querySelector('.comment-form');
    const commentTextInput = commentForm.querySelector('input');
    commentForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = commentTextInput.value.trim();
      if (!text) return;
      const target = state.feed.find((item) => item.id === post.id);
      target.comments.push({ by: ME, text, at: Date.now() });
      persistAndRender();
    });

    const commentsList = fragment.querySelector('.comments');
    post.comments.slice(-3).forEach((comment) => {
      const li = document.createElement('li');
      li.textContent = `${comment.by}: ${comment.text}`;
      commentsList.appendChild(li);
    });

    feedList.appendChild(fragment);
  });
}

function renderGamification() {
  const completed = state.history.length;
  const streak = getStreak();
  const likes = state.feed.reduce((sum, post) => sum + post.likes, 0);

  const badges = [
    completed >= 1 ? 'Starter' : null,
    completed >= 10 ? 'Chore Champ' : null,
    streak >= 3 ? 'Streak Keeper' : null,
    likes >= 5 ? 'Community Favorite' : null
  ].filter(Boolean);

  badgeList.innerHTML = badges.length
    ? badges.map((badge) => `<li>${badge}</li>`).join('')
    : '<li>Keep going for your first badge!</li>';

  const points = completed * POINTS_PER_CHORE + streak * POINTS_PER_STREAK_DAY + likes;
  const board = [
    { name: ME, points },
    { name: 'Alex', points: 90 },
    { name: 'Jordan', points: 70 }
  ].sort((a, b) => b.points - a.points);

  leaderboardList.innerHTML = board
    .map((entry) => `<li>${entry.name} — ${entry.points} pts</li>`)
    .join('');

  encouragement.textContent =
    streak >= 5
      ? '🔥 Incredible consistency — your home is loving this streak!'
      : completed >= 5
      ? '💪 Great momentum. Keep stacking small wins!'
      : '🌱 Start with one quick action and build your streak today.';
}

function getStreak() {
  if (!state.history.length) return 0;
  const days = new Set(
    state.history.map((entry) => {
      const date = new Date(entry.createdAt);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    })
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  renderChores();
  renderProgress();
  renderFeed();
  renderGamification();
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed) return structuredClone(initialState);
    return {
      chores: Array.isArray(parsed.chores) ? parsed.chores : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      feed: Array.isArray(parsed.feed) ? parsed.feed : []
    };
  } catch {
    return structuredClone(initialState);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

render();

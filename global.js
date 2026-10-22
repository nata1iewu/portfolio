console.log('IT’S ALIVE!');

function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'resume/', title: 'Resume' },
    { url: 'contact/', title: 'Contact' },
    { url: 'https://github.com/nata1iewu', title: 'GitHub' }
];

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/"
    : "https://nata1iewu.github.io/portfolio/";

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
    let url = p.url;
    let title = p.title;

    if (!url.startsWith('http') && !url.startsWith('//')) {
        url = BASE_PATH + url;
    }

    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;

    if (a.host == location.host && a.pathname == location.pathname) {
        a.classList.add('current');
    }

    if (a.host !== location.host) {
        a.target = '_blank';
    }
    nav.append(a);
}

document.body.insertAdjacentHTML(
    'beforeend',
    `,
<label class = 'color-scheme'>
Theme:<select id="theme-switch">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  `
);

const select = document.querySelector('#theme-switch');

function setColorScheme(colorScheme) {
    document.documentElement.style.setProperty('color-scheme', colorScheme);
    select.value = colorScheme;
}

if ('colorScheme' in localStorage) {
    const savedScheme = localStorage.getItem('colorScheme');
    setColorScheme(savedScheme);
}

select.addEventListener('input', (event) => {
    const newScheme = event.target.value;
    setColorScheme(newScheme);
    localStorage.setItem('colorScheme', newScheme);
});

const form = document.querySelector('.contact-form');
form?.addEventListener('submit', function (event) {
    event.preventDefault();
    const data = new FormData(form);
    let url = form.action + "?";
    const params = [];
    for (let [name, value] of data) {
        params.push(`${name}=${encodeURIComponent(value)}`);
    }
    url += params.join('&');
    location.href = url;
});

export async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching or parsing JSON data:', error);
    }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
    containerElement.innerHTML = '';
    for (const project of projects) {
        const article = document.createElement('article');
        article.innerHTML = `
    <h3>${project.title}</h3>
    <img src="${new URL('..' + project.image, import.meta.url).href}" alt="${project.title}">
    <p>${project.description}</p>
`;
        containerElement.appendChild(article);
    }
}
export async function fetchGitHubData(username) {
    return fetchJSON(`https://api.github.com/users/${username}`);
}
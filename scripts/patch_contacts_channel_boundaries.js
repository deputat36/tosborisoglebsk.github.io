const fs = require('fs');
const path = require('path');

const pagePath = path.join(process.cwd(), 'contacts', 'index.html');
const existingId = 'id="contact-boundaries"';
const marker = '<section class="section"><div class="container section-head"><div><h2>Рабочие контакты</h2>';
const oldInternalLink = '<a class="btn" href="/data-requests/">Запросы данных</a>';
const publicStatusLink = '<a class="btn" href="/data-update/">Состояние каталога</a>';
const block = '<section class="section" id="contact-boundaries"><div class="container section-head"><div><h2>Какой канал использовать</h2><p>Контакты портала предназначены для материалов и уточнений, но не заменяют профильные службы и официальные приёмные</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><span class="tag ok">Редакция портала</span><h3>Новости, фото и исправления</h3><p>Используйте ВК или ответственный контакт, чтобы передать материал, уточнить карточку ТОС, предложить проект или сообщить о технической ошибке сайта.</p></div></article><article class="card"><div class="card-inner"><span class="tag">Официальное обращение</span><h3>Решение органа или учреждения</h3><p>Если нужен официальный ответ, регистрационный номер, решение администрации, организации или коммунальной службы, обращайтесь через их официальную приёмную. Сообщение порталу не заменяет такое обращение.</p></div></article><article class="card"><div class="card-inner"><span class="tag warn">Срочная ситуация</span><h3>Угроза жизни, здоровью или безопасности</h3><p>Не ждите ответа редакции и не используйте портал как экстренную службу. Обращайтесь в профильную экстренную или аварийную службу.</p></div></article><article class="card"><div class="card-inner"><span class="tag">Срок ответа</span><h3>Рабочий, а не гарантированный канал</h3><p>Материалы обрабатываются вручную. Получение сообщения, срок ответа и публикация не гарантируются автоматически; редактор может запросить источник, согласие или дополнительные сведения.</p></div></article></div><div class="container notice"><b>Границы ответственности:</b> портал является информационным и редакционным проектом. Он не является органом власти, диспетчерской, экстренной службой или системой официальной регистрации обращений. Не передавайте через публичные сообщения пароли, платёжные реквизиты, паспортные данные и другие лишние персональные сведения. <a href="/privacy/">Правила персональных данных</a> · <a href="/faq/#safety-faq">Безопасность</a>.</div></section>';

function main() {
  if (!fs.existsSync(pagePath)) throw new Error(`Missing file: ${pagePath}`);

  let html = fs.readFileSync(pagePath, 'utf8');
  let changed = false;

  if (html.includes(oldInternalLink)) {
    html = html.replace(oldInternalLink, publicStatusLink);
    changed = true;
  } else if (!html.includes(publicStatusLink)) {
    throw new Error('Contacts hero data link marker not found');
  }

  if (!html.includes(existingId)) {
    if (!html.includes(marker)) throw new Error('Contacts working contacts marker not found');
    html = html.replace(marker, `${block}${marker}`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(pagePath, html, 'utf8');
    console.log('Patched contacts channel boundaries');
  } else {
    console.log('Contacts channel boundaries already exist');
  }
}

main();

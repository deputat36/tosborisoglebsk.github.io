
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("toses-container");
  if (!container) return;

  fetch("data/toses_demo.json")
    .then((res) => res.json())
    .then((data) => {
      data.forEach((tos) => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <h3>${tos.name}</h3>
          <p><strong>Населённый пункт:</strong> ${tos.location}</p>
          <p><strong>Председатель:</strong> ${tos.chairperson}</p>
          <p><strong>Контакты:</strong> ${tos.contacts}</p>
          <p><strong>Жителей:</strong> ${tos.population}</p>
          <p>${tos.description}</p>
        `;
        container.appendChild(card);
      });
    })
    .catch((err) => {
      container.innerHTML = "<p>Не удалось загрузить данные ТОСов.</p>";
      console.error(err);
    });
});

const $ = (s) => document.querySelector(s);

function mostrarErro(msg) {
  $("#erroLogin").textContent = msg;
  $("#erroLogin").classList.remove("d-none");
}

(async () => {
  if (!configurado) {
    mostrarErro("Configure o arquivo js/config.js com a URL e a chave do Supabase.");
    $("#btnEntrar").disabled = true;
    return;
  }
  const { data } = await sb.auth.getSession();
  if (data.session) location.href = "index.html";
})();

$("#formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!configurado) return;

  const btn = $("#btnEntrar");
  btn.disabled = true;
  btn.textContent = "Entrando...";
  $("#erroLogin").classList.add("d-none");

  const { error } = await sb.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#senha").value,
  });

  if (error) {
    mostrarErro("E-mail ou senha incorretos.");
    btn.disabled = false;
    btn.textContent = "Entrar";
    return;
  }
  location.href = "index.html";
});

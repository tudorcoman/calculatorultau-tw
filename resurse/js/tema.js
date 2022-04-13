window.addEventListener("load", function() {
    document.getElementById("btn_tema").onclick = function() {
        var tema = localStorage.getItem("tema");
        if (tema)
            localStorage.removeItem("tema");
        else
            localStorage.setItem("tema", "dark");

        document.body.classList.toggle("dark");
    }
})
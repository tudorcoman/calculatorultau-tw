const express = require("express");
const fs = require("fs");
const sharp = require("sharp");
const ejs = require("ejs");
const sass = require("sass");
const {Client} = require("pg");
const res = require("express/lib/response");


var client = new Client({user:"tw", password: "tehniciweb", database: "calculatorultau", host: "localhost", port: 5432})
client.connect();
app = express();

function generareRandomGalerieAnimata() {
    nrRandomImag = (1 + Math.floor(Math.random() * 3)) * 3;
    offsetGalerieAnimata = Math.floor(Math.random() * (11 - nrRandomImag));
}

generareRandomGalerieAnimata();

app.set("view engine", "ejs");
app.use("/resurse", express.static(__dirname + "/resurse"))
 
app.get("/galerie-animata.css", function(req, res) {
    var sirScss = fs.readFileSync(__dirname+"/resurse/scss/galerie_animata.scss").toString("utf8");
    var culori = ["navy", "black", "purple", "grey"];
    var indiceAleator = Math.floor(Math.random() * culori.length);
    var culoareAleatoare = culori[indiceAleator];
    generareRandomGalerieAnimata();
    rezScss = ejs.render(sirScss, {culoare:culoareAleatoare, nrimag:nrRandomImag});
    var caleScss = __dirname+"/temp/galerie_animata.scss";
    fs.writeFileSync(caleScss, rezScss);
    try {
        var caleCss = __dirname+"/temp/galerie_animata.css";
        var rezCss = sass.compile(caleScss, {sourceMap:true});
        fs.writeFileSync(caleCss, rezCss.css);
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(caleCss);
    } catch (err) {
        console.log(err);
        res.send("Eroare");
    }
})

app.get("/resurse/css/:nume.css", function(req, res) {
    try {
        var scss = fs.readFileSync(__dirname+"/resurse/scss/" + req.params.nume + ".scss").toString("utf8");
        var rezCss = sass.compileString(scss).css;
        res.setHeader('Content-Type', 'text/css');
        res.send(rezCss);
    } catch(err) {
        console.log(err);
    }
})

app.get("/*.ejs", function(req, res) {
    // res.status(403).render("pagini/403");
    randeazaEroare(res, 403);
    res.end();
})

app.get("/*.scss", function(req, res) {
    // res.status(403).render("pagini/403");
    randeazaEroare(res, 403);
    res.end();
})

app.get(["/", "/index", "/home"], function(req, res) {
    client.query("select * from products", function(err, rezQuery) {
        if(err)
            console.log(err);
        else {
            console.log(rezQuery);
            res.render("pagini/index", {ip:req.ip, imagini:obImagini.imagini, nrRandomImag: nrRandomImag, offset: offsetGalerieAnimata, produse:rezQuery.rows});
        }
    })
    
})

app.get("/eroare", function(req, res) {
    randeazaEroare(res, 1, "Titlu schimbat");
})

app.get("/*", function(req, res){
    res.render("pagini"+req.url, {imagini_galerie_statica: filtreazaImaginiDupaOra()}, function(err, rezRender){
        if (err){
            if(err.message.includes("Failed to lookup view")){
                console.log(err);
                // res.status(404).render("pagini/404");
                randeazaEroare(res, 404);
            }
            else{
                
                res.render("pagini/eroare_generala");
            }
        }
        else{
            // console.log(rezRender);
            res.send(rezRender);
        }
    });
   
    //console.log("generala:",req.url);
    res.end();
})

app.get("/", function(req, res) {
    res.write("Cerere generala");
    res.end();
})


function getDateFromHour(hour) {
    let v = hour.split(":");
    let h = parseInt(v[0]), m = parseInt(v[1]);
    return new Date().setHours(h, m);
}

function creeazaImagini(){
    var buf=fs.readFileSync(__dirname+"/resurse/json/galerie.json").toString("utf8");
    obImagini=JSON.parse(buf);//global
    for (let imag of obImagini.imagini){
        let nume_imag, extensie;
        [nume_imag, extensie ]=imag.fisier.split(".")// "abc.de".split(".") ---> ["abc","de"]
        let dim_mic=150;
        let dim_mediu=300;
        
        imag.mic=`${obImagini.cale_galerie}/mic/${nume_imag}-${dim_mic}.webp` //nume-150.webp // "a10" b=10 "a"+b `a${b}`
        imag.mediu=`${obImagini.cale_galerie}/mediu/${nume_imag}-${dim_mediu}.webp` //nume-150.webp // "a10" b=10 "a"+b `a${b}`

        imag.mare=`${obImagini.cale_galerie}/${imag.fisier}`;
        if (!fs.existsSync(imag.mic)) {
            sharp(__dirname+"/"+imag.mare).resize(dim_mic).toFile(__dirname+"/"+imag.mic);
        }
        if (!fs.existsSync(imag.mediu)) {
            sharp(__dirname+"/"+imag.mare).resize(dim_mediu).toFile(__dirname+"/"+imag.mediu);
        }
    }
}

function filtreazaImaginiDupaOra() {
    var imaginiFiltrate = [];
    for (let imag of obImagini.imagini) {
        let ore = imag.timp.split('-');
        let inceput = getDateFromHour(ore[0]), sfarsit = getDateFromHour(ore[1]), now = new Date();

        if (inceput <= now && now <= sfarsit) {
            imaginiFiltrate.push(imag);
        }
    }
    return imaginiFiltrate;
}

function creeazaErori(){
    var buf=fs.readFileSync(__dirname+"/resurse/json/erori.json").toString("utf8");
    obErori=JSON.parse(buf);
    console.log(obErori);
}

creeazaImagini();
creeazaErori();


function randeazaEroare(res, identificator, titlu, text, imagine) {
    var eroare = obErori.erori.find(function (elem) {
        return elem.identificator == identificator;
    });

    titlu = titlu || (eroare & eroare.titlu) || "Eroare - eroare";
    text = text || (eroare & eroare.text) || "A aparut o eroare. Va rugam sa contactati administratorul de server. ";
    imagine = imagine || (eroare & (obErori.cale_baza + "/" + eroare.imagine)) || "/resurse/img/erori/interzis.png";

    if (eroare && eroare.status) {
        res.status(eroare.identificator).render("pagini/eroare_generala", {titlu: eroare.titlu, text: eroare.text, imagine: obErori.cale_baza + "/" + eroare.imagine});
    } else {
        res.render("pagini/eroare_generala", {titlu: titlu, text: text, imagine: imagine});
    }    
}

app.listen(8080);
console.log("A pornit");

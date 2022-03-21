const express = require("express");
const fs = require("fs");
const sharp = require("sharp");
const ejs = require("ejs");
const sass = require("sass");
const {Client} = require("pg");


var client = new Client({user:"tw", password: "tehniciweb", database: "calculatorultau", host: "localhost", port: 5432})
client.connect();
app = express();

app.set("view engine", "ejs");
app.use("/resurse", express.static(__dirname + "/resurse"))
 
app.get("/*.ejs", function(req, res) {
    res.status(403).render("pagini/403");
    res.end();
})

app.get(["/", "/index", "/home"], function(req, res) {
    client.query("select * from products", function(err, rezQuery) {
        if(err)
            console.log(err);
        else {
            console.log(rezQuery);
            res.render("pagini/index", {ip:req.ip, imagini:obImagini.imagini, produse:rezQuery.rows});
        }
    })
    
})

app.get("/galerie-animata.css", function(req, res) {
    var sirScss = fs.readFileSync(__dirname+"/resurse/scss/galerie_animata.scss").toString("utf8");
    var culori = ["navy", "black", "purple", "grey"];
    var indiceAleator = Math.floor(Math.random() * culori.length);
    var culoareAleatoare = culori[indiceAleator];
    rezScss = ejs.render(sirScss, {culoare:culoareAleatoare});
    console.log(rezScss);
    var caleScss = __dirname+"/temp/galerie_animata.scss";
    fs.writeFileSync(caleScss, rezScss);
    try {
        var caleCss = __dirname+"/temp/galerie_animata.css";
        var rezCss = sass.compile(caleCss, {sourceMap:true});
        fs.writeFileSync(caleCss, rezCss);
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(caleCss);
    } catch (err) {
        console.log(err);
        res.send("Eroare");
    }
})

app.get("/*", function(req, res){
    res.render("pagini"+req.url, function(err, rezRender){
        if (err){
            if(err.message.includes("Failed to lookup view")){
                console.log(err);
                res.status(404).render("pagini/404");
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


function creeazaImagini(){
    var buf=fs.readFileSync(__dirname+"/resurse/json/galerie.json").toString("utf8");
    obImagini=JSON.parse(buf);//global
    console.log(obImagini);
    //console.log(obImagini);
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

creeazaImagini();

app.listen(8080);
console.log("A pornit");

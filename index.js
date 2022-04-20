const express = require("express");
const fs = require("fs");
const sharp = require("sharp");
const ejs = require("ejs");
const sass = require("sass");
const {Client} = require("pg");
const res = require("express/lib/response");
const formidable = require('formidable');
const crypto = require('crypto');
const session = require('express-session');
const nodemailer = require('nodemailer');

const connectionString = process.env.DATABASE_URL;
var client = new Client({connectionString, ssl: {rejectUnauthorized: false}})

client.connect();
app = express();

app.use(session({
    secret: 'abcdefg',//folosit de express session pentru criptarea id-ului de sesiune
    resave: false,
    saveUninitialized: false,
    unset: 'destroy'
}));


const obGlobal = {obImagini: null, obErori: null, nrRandomImag: null, offsetGalerieAnimata: null, parolaServer: "tehniciweb"};

function generareRandomGalerieAnimata() {
    obGlobal.nrRandomImag = (1 + Math.floor(Math.random() * 3)) * 3;
    obGlobal.offsetGalerieAnimata = Math.floor(Math.random() * (11 - obGlobal.nrRandomImag));
}

generareRandomGalerieAnimata();

app.set("view engine", "ejs");
app.use("/resurse", express.static(__dirname + "/resurse"))
app.use("/*", function(req, res, next) {
    res.locals.propGenerala = "asdf";
    res.locals.utilizator = req.session.utilizator;
    console.log(res.locals.utilizator);
    console.log(req.session);

    client.query("select * from unnest(enum_range(null::categ_produse))", function(err, rezTipuri) {
        res.locals.categoriiProduse = rezTipuri.rows; 
        console.log(rezTipuri.rows);
        next();
    });
})

app.get("/galerie-animata.css", function(req, res) {
    var sirScss = fs.readFileSync(__dirname+"/resurse/scss/galerie_animata.scss").toString("utf8");
    var culori = ["navy", "black", "purple", "grey"];
    var indiceAleator = Math.floor(Math.random() * culori.length);
    var culoareAleatoare = culori[indiceAleator];
    generareRandomGalerieAnimata();
    rezScss = ejs.render(sirScss, {culoare:culoareAleatoare, nrimag:obGlobal.nrRandomImag});
    //var caleScss = __dirname+"/temp/galerie_animata.scss";
    // fs.writeFileSync(caleScss, rezScss);
    /*try {
        var caleCss = __dirname+"/temp/galerie_animata.css";
        var rezCss = sass.compile(caleScss, {sourceMap:true});
        fs.writeFileSync(caleCss, rezCss.css);
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(caleCss);
    } catch (err) {
        console.log(err);
        res.send("Eroare");
    }*/
    var rezCss = sass.compileString(rezScss).css;
    res.setHeader('Content-Type', 'text/css');
    res.send(rezCss);
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

app.get("/produse", function(req, res){
    client.query("select * from unnest(enum_range(null::tipuri_produse))", function(err, rezCateg) {
        var cond_where = req.query.tip ? `categorie='${req.query.categorie}'` : "1=1";
        console.log(cond_where);
        client.query("select * from produse where "+cond_where, function(err, rezQuery) {
            console.log(rezQuery);
            res.render("pagini/produse", {produse:rezQuery.rows, optiuni:rezCateg.rows})
        });
    });
})

app.get("/produs/:id", function(req, res) {
    client.query(`select * from produse where id= ${req.params.id}`, function(err, rezQuery) {
        console.log(rezQuery);
        res.render("pagini/produs", {prod: rezQuery.rows[0]})
    })
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
    res.render("pagini/index", {ip:req.ip, imagini:obGlobal.obImagini.imagini, nrRandomImag: obGlobal.nrRandomImag, offset: obGlobal.offsetGalerieAnimata});
})

app.get("/eroare", function(req, res) {
    randeazaEroare(res, 1, "Titlu schimbat");
})

app.get("/", function(req, res) {
    res.write("Cerere generala");
    res.end();
})

//------------------------------utilizatori-------------------------------------------
app.post("/inreg", function(req, res) {
    var formular = new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFisier) {

        var eroare = "";
        if (campuriText.username == "") {
            eroare += "Username necompletat. ";
        }

        if (!campuriText.username.match(new RegExp("^[A-Za-z0-9]+$"))) {
            eroare += "Username nu contine caracterele cerute. ";
        }
        
        if (eroare == "") {
            queryUtiliz = `select username from utilizatori where username='${campuriText.username}'`;
            client.query(queryUtiliz, function(err, rezUtiliz) {
                if (rezUtiliz.rows.length != 0) {
                    eroare += "Username-ul mai exista. ";
                } else {
                    var parolaCriptata = crypto.scryptSync(campuriText.parola, obGlobal.parolaServer, 64).toString('hex');
                    var comandaInserare = `insert into utilizatori (username, nume, prenume, parola, email, culoare_chat) values ('${campuriText.username}', '${campuriText.nume}', '${campuriText.prenume}', '${parolaCriptata}', '${campuriText.email}', '${campuriText.culoare_chat}')`;
                    client.query(comandaInserare, function(err, rezInserare) {
                        if(err) {
                            console.log(err);
                            res.render("pagini/inregistrare", {err: "Eroare baza de date"});
                        } else {
                            res.render("pagini/inregistrare", {raspuns: "Datele au fost introduse"});
                            trimiteMail(campuriText.email, "Te-ai inregistrat", "text", "");
                        }
                    });
                }
            });
        } else {

        }
    });
})

app.post("/login", function(req, res) {
    var formular = new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFisier) {
        var parolaCriptata = crypto.scryptSync(campuriText.parola, obGlobal.parolaServer, 64).toString('hex');
        var querySelect = `select * from utilizatori where username = '${campuriText.username}' and parola = '${parolaCriptata}'`;
        client.query(querySelect, function(err, rezSelect) {
            if (err)
                console.log(err);
            else {
                console.log(querySelect);
                console.log(rezSelect.rows.length);
                if (rezSelect.rows.length == 1) { // autentificare cu succes
                    req.session.utilizator = {
                        nume: rezSelect.rows[0].nume,
                        prenume: rezSelect.rows[0].prenume,
                        username: rezSelect.rows[0].username,
                        email: rezSelect.rows[0].email,
                        culoare_chat: rezSelect.rows[0].culoare_chat,
                        rol: rezSelect.rows[0].rol
                    }
                    res.redirect("/index");
                }
            }
        });
    });
})

app.get("/logout", function(req, res) {
    req.session.destroy();
    res.locals.utilizator = null;
    console.log("LOGOUT");
    res.render("pagini/logout");
});

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


function getDateFromHour(hour) {
    let v = hour.split(":");
    let h = parseInt(v[0]), m = parseInt(v[1]);
    return new Date().setHours(h, m);
}

function creeazaImagini(){
    var buf=fs.readFileSync(__dirname+"/resurse/json/galerie.json").toString("utf8");
    obGlobal.obImagini=JSON.parse(buf);//global
    for (let imag of obGlobal.obImagini.imagini){
        let nume_imag, extensie;
        [nume_imag, extensie ]=imag.fisier.split(".")// "abc.de".split(".") ---> ["abc","de"]
        let dim_mic=150;
        let dim_mediu=300;
        
        imag.mic=`${obGlobal.obImagini.cale_galerie}/mic/${nume_imag}-${dim_mic}.webp` //nume-150.webp // "a10" b=10 "a"+b `a${b}`
        imag.mediu=`${obGlobal.obImagini.cale_galerie}/mediu/${nume_imag}-${dim_mediu}.webp` //nume-150.webp // "a10" b=10 "a"+b `a${b}`

        imag.mare=`${obGlobal.obImagini.cale_galerie}/${imag.fisier}`;
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
    for (let imag of obGlobal.obImagini.imagini) {
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
    obGlobal.obErori=JSON.parse(buf);
    console.log(obGlobal.obErori);
}

creeazaImagini();
creeazaErori();


function randeazaEroare(res, identificator, titlu, text, imagine) {
    var eroare = obGlobal.obErori.erori.find(function (elem) {
        return elem.identificator == identificator;
    });

    titlu = titlu || (eroare & eroare.titlu) || "Eroare - eroare";
    text = text || (eroare & eroare.text) || "A aparut o eroare. Va rugam sa contactati administratorul de server. ";
    imagine = imagine || (eroare & (obGlobal.obErori.cale_baza + "/" + eroare.imagine)) || "/resurse/img/erori/interzis.png";

    if (eroare && eroare.status) {
        res.status(eroare.identificator).render("pagini/eroare_generala", {titlu: eroare.titlu, text: eroare.text, imagine: obGlobal.obErori.cale_baza + "/" + eroare.imagine});
    } else {
        res.render("pagini/eroare_generala", {titlu: titlu, text: text, imagine: imagine});
    }    
}

async function trimiteMail(email, subiect, mesajText, mesajHtml, atasamente=[]){
    var transp= nodemailer.createTransport({
        service: "gmail",
        secure: false,
        auth:{//date login
            user:obGlobal.emailServer,
            pass:"rwgmgkldxnarxrgu"
        },
        tls:{
            rejectUnauthorized:false
        }
    });
    //genereaza html
    await transp.sendMail({
        from:obGlobal.emailServer,
        to:email,
        subject:subiect,//"Te-ai inregistrat cu succes",
        text:mesajText, //"Username-ul tau este "+username
        html: mesajHtml,// `<h1>Salut!</h1><p style='color:blue'>Username-ul tau este ${username}.</p> <p><a href='http://${numeDomeniu}/cod/${username}/${token}'>Click aici pentru confirmare</a></p>`,
        attachments: atasamente
    })
    console.log("trimis mail");
}

var s_port = process.env.PORT || 5000;
app.listen(s_port);
console.log("A pornit");

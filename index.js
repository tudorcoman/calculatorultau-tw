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
const path = require('path');

const obGlobal = {obImagini: null, obErori: null, nrRandomImag: null, offsetGalerieAnimata: null, parolaServer: "tehniciweb", emailServer: "calculatorultau.ro@gmail.com", port: 8888, sirAP: "ABCDEFGHIJKLMNOP", sirCifre: "0123456789"};

var dbConfig;
if (process.env.PORT) {
    obGlobal.port = process.env.PORT;
    obGlobal.protocol = "https://";
    obGlobal.numeDomeniu = "calculatorultau.herokuapp.com";
    const connectionString = process.env.DATABASE_URL;
    dbConfig = {connectionString, ssl: {rejectUnauthorized: false}};
} else {
    obGlobal.protocol = "http://";
    obGlobal.numeDomeniu = "localhost:" + obGlobal.port;
    dbConfig = {user:"tw", password: "tehniciweb", database: "calculatorultau", host: "localhost", port: 5432};
}

var client = new Client(dbConfig);
client.connect();
app = express();

app.use(session({
    secret: 'abcdefg',//folosit de express session pentru criptarea id-ului de sesiune
    resave: false,
    saveUninitialized: false,
    unset: 'destroy'
}));

app.use(["/produse_cos","/cumpara"],express.json({limit:'2mb'}));

function generareRandomGalerieAnimata() {
    obGlobal.nrRandomImag = (1 + Math.floor(Math.random() * 3)) * 3;
    obGlobal.offsetGalerieAnimata = Math.floor(Math.random() * (11 - obGlobal.nrRandomImag));
}

function stergeAccesariVechi(){
    var queryDelete="delete from accesari where now()-data_accesare >= interval '10 minutes' ";
    client.query(queryDelete, function(err, rezQuery){
        console.log(err);
    });
}
 
stergeAccesariVechi();
setInterval(stergeAccesariVechi, 10*60*1000);

generareRandomGalerieAnimata();

app.set("view engine", "ejs");
app.use("/resurse", express.static(__dirname + "/resurse"))
app.use("/poze_uploadate", express.static(__dirname+"/poze_uploadate"))

app.use("/*", function(req, res, next) {
    //res.locals.propGenerala = "asdf";
    res.locals.utilizator = req.session.utilizator;
    res.locals.mesajLogin = req.session.mesajLogin;
    req.session.mesajLogin = null;
    client.query("select * from unnest(enum_range(null::categ_produse))", function(err, rezTipuri) {
        res.locals.categoriiProduse = rezTipuri.rows; 
        console.log(rezTipuri.rows);
        next();
    });
}, function(req, res, next) {
    let id_utiliz = req.session.utilizator ? req.session.utilizator.id : null;
    // var queryInsert = `INSERT INTO accesari (ip, user_id, pagina) VALUES ('${getIp(req)}', ${id_utiliz}, '${req.url}')`;
    var queryInsert = `INSERT INTO accesari (ip, user_id, pagina) VALUES ($1, $2, $3)`;
    client.query(queryInsert, [getIp(req), id_utiliz, req.url]).then(rezQuery => {}, err => {
        console.log(err);
    });
    next();
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

foldere = ["temp", "poze_uploadate"];
for (let folder of foldere) {
    let caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
    }
}

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
        if (req.query.categorie) {
            client.query("select * from produse where categorie=$1", [req.query.categorie]).then(rezQuery => {
                console.log(rezQuery);
                res.render("pagini/produse", {produse:rezQuery.rows, optiuni:rezCateg.rows})
            });
        } else {
            client.query("select * from produse", function(err, rezQuery) {
                console.log(rezQuery);
                res.render("pagini/produse", {produse:rezQuery.rows, optiuni:rezCateg.rows})
            });
        }
    });
})

app.get("/produs/:id", function(req, res) {
    client.query(`select * from produse where id=$1`, [req.params.id]).then(rezQuery => {
        console.log(rezQuery);
        res.render("pagini/produs", {prod: rezQuery.rows[0]});
    });
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

app.get(["/", "/index", "/home", "/login"], function(req, res) {
    querySelect="select username, nume from utilizatori where id in (select distinct user_id from accesari where now()-data_accesare <= interval '5 minutes')"
    client.query(querySelect, function(err, rezQuery){
        useriOnline=[]
        if(err) console.log(err);
        else useriOnline= rezQuery.rows;
        res.render("pagini/index", {ip:getIp(req), imagini:obGlobal.obImagini.imagini, nrRandomImag: obGlobal.nrRandomImag, offset: obGlobal.offsetGalerieAnimata, useriOnline: useriOnline});
    });
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
    var username;
    var caleUtiliz, numeFisier;
    var formular = new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFisier) {

        var eroare = "";
        if (campuriText.username == "") {
            eroare += "Username necompletat. ";
        }

        if (!campuriText.username.match(new RegExp("^[A-Za-z0-9]+$"))) {
            eroare += "Username nu contine caracterele cerute. ";
        }

        if (!campuriText.email.match(new RegExp("^[A-Za-z0-9_\\-\\.]+@[A-Za-z0-9]+\\.[a-zA-Z]{2,3}$"))) {
            eroare += "Emailul nu este valid. ";
        }

        if (campuriText.parola.match(new RegExp("^.*[%\\^&\\*].*$"))) {
            eroare += "Parola contine caractere interzise.";
        }

        
        
        if (eroare == "") {
            queryUtiliz = `select username from utilizatori where username=$1`;
            client.query(queryUtiliz, [campuriText.username]).then(rezUtiliz => {
                if (rezUtiliz.rows.length != 0) {
                    eroare += "Username-ul mai exista. ";
                } else {
                    var token = genereazaToken(campuriText.username);
                    var parolaCriptata = crypto.scryptSync(campuriText.parola, obGlobal.parolaServer, 64).toString('hex');
                    var comandaInserare = `insert into utilizatori (username, nume, prenume, parola, email, culoare_chat, cod, blocat, imagine) values ($1, $2, $3, $4, $5, $6, $7, false, $8)`;
                    client.query(comandaInserare, [campuriText.username, campuriText.nume, campuriText.prenume, parolaCriptata, campuriText.email, campuriText.culoare_chat, token, numeFisier])
                    .then(
                        rezInserare => {
                            res.render("pagini/inregistrare", {raspuns: "Datele au fost introduse"});
                            // http://localhost:8080/cod/[username]/[token]
                            let linkConfirmare = `${obGlobal.protocol}${obGlobal.numeDomeniu}/confirmare_inreg${genereazaLink(campuriText.username, token)}`;
                            console.log(linkConfirmare);
                            trimiteMail(campuriText.email, `Buna, ${campuriText.username}`, "text",`<h1 style='background-color: lightblue;'>Bine ai venit in comunitatea CalculatorulTau!</h1><p>Username-ul tau este ${campuriText.username}.</p><p>Link confirmare: <a href="${linkConfirmare}">${linkConfirmare}</a></p>`);
                        }, 
                        err => {
                            console.log(err);
                            res.render("pagini/inregistrare", {err: "Eroare baza de date"});
                        }   
                    );
                }
            });
        } else {
            res.render("pagini/inregistrare", {err: "Eroare: "+eroare});
        }
    })
    formular.on("field", function(nume, val) {
        if (nume == "username")
            username = val;
    })
    formular.on("fileBegin", function(nume, fisier) {
        caleUtiliz = path.join(__dirname, "poze_uploadate", username);
        if(fs.existsSync(caleUtiliz)) {
            fs.rmdirSync(caleUtiliz);
        }
        fs.mkdirSync(caleUtiliz);
        let extensieFisier = fisier.originalFilename.split(".")[1];
        numeFisier = path.join(caleUtiliz, `poza.${extensieFisier}`);
        fisier.filepath = numeFisier;
    })
    formular.on("file", function(nume, fisier) {
        
    })
})

app.post("/login", function(req, res) {
    var formular = new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFisier) {
        var parolaCriptata = crypto.scryptSync(campuriText.parola, obGlobal.parolaServer, 64).toString('hex');
        //var querySelect = `select * from utilizatori where username = '${campuriText.username}' and parola = '${parolaCriptata}' and confirmat_mail=true`;
        // sql injection safe:
        var querySelect = `select * from utilizatori where username = $1::text and parola = $2::text and confirmat_mail=true and blocat=false`;

        client.query(querySelect, [campuriText.username, parolaCriptata], function(err, rezSelect) {
            if (err)
                console.log(err);
            else {
                console.log(querySelect);
                console.log(rezSelect.rows.length);
                if (rezSelect.rows.length == 1) { // autentificare cu succes
                    req.session.utilizator = {
                        id: rezSelect.rows[0].id,
                        nume: rezSelect.rows[0].nume,
                        prenume: rezSelect.rows[0].prenume,
                        username: rezSelect.rows[0].username,
                        email: rezSelect.rows[0].email,
                        culoare_chat: rezSelect.rows[0].culoare_chat,
                        rol: rezSelect.rows[0].rol
                    }
                    res.redirect("/index");
                } else {
                    req.session.mesajLogin = "Login esuat";
                    res.redirect("/index");
                }
            }
        });
    });
})

app.get("/profilepicture", function(req, res) {
    if (req.session.utilizator) {
        client.query("select * from utilizatori where username=$1", [req.session.utilizator.username])
        .then(rez => {
            console.log(rez);
            console.log(rez.rowCount);
            if (rez.rowCount > 0 && rez.rows[0].imagine)
                res.sendFile(rez.rows[0].imagine);
            else
                res.send("none");
        })
    } else
        res.send("none");
})

// ---------------- Update profil -----------------------------
 
app.post("/profil", function(req, res){
    console.log("profil");
    if (!req.session.utilizator){
        res.render("pagini/eroare_generala",{text:"Nu sunteti logat."});
        return;
    }
    var formular= new formidable.IncomingForm(), caleUtiliz, numeFisier, updateazaImag = "";
 
    formular.parse(req,function(err, campuriText, campuriFile){
        var criptareParola=crypto.scryptSync(campuriText.parola,obGlobal.parolaServer, 64).toString('hex');
        if (campuriText.parolanoua != "" && campuriText.parolanoua == campuriText.rparolanoua) {
            if (numeFisier) {
                updateazaImag = 'imagine=$8,';
            }
            var criptareParolaNoua = crypto.scryptSync(campuriText.parolanoua, obGlobal.parolaServer, 64).toString('hex');
            var queryUpdate=`update utilizatori set ${updateazaImag} nume=$1, prenume=$2, email=$3, culoare_chat=$4, parola=$7 where username=$5 and parola=$6`;
            console.log(queryUpdate);
            var lista = [campuriText.nume, campuriText.prenume, campuriText.email, campuriText.culoare_chat, req.session.utilizator.username, criptareParola, criptareParolaNoua];
            if (updateazaImag != "")
                lista.push(numeFisier);
            client.query(queryUpdate, lista)
            .then(
                rez => {
                    console.log(rez.rowCount);
                    if (rez.rowCount==0){
                        res.render("pagini/profil",{mesaj:"Update-ul nu s-a realizat. Verificati parola introdusa."});
                        return;
                    } else {
                        req.session.utilizator.nume = campuriText.nume;
                        req.session.utilizator.prenume = campuriText.prenume;
                        req.session.utilizator.email = campuriText.email;
                        req.session.utilizator.culoare_chat = campuriText.culoare_chat;
                    }
                    res.render("pagini/profil",{mesaj:"Update-ul s-a realizat cu succes."});
                    trimiteMail(req.session.utilizator.email, "Noile tale date", "Profilul tau a fost actualizat. Noile tale date sunt:", `<br><br>Nume: ${req.session.utilizator.nume} <br> Prenume: ${req.session.utilizator.prenume} <br> Email: ${req.session.utilizator.email}`);
                },
                err => {
                    console.log(err);
                    res.render("pagini/eroare_generala",{text:"Eroare baza date. Incercati mai tarziu."});
                }
            );
        } else {
            if (numeFisier) {
                updateazaImag = 'imagine=$7,';
            }
            var queryUpdate=`update utilizatori set ${updateazaImag} nume=$1, prenume=$2, email=$3, culoare_chat=$4 where username=$5 and parola=$6`;
            console.log(queryUpdate);
            var lista = [campuriText.nume, campuriText.prenume, campuriText.email, campuriText.culoare_chat, req.session.utilizator.username, criptareParola];
            if (updateazaImag != "")
                lista.push(numeFisier);
            client.query(queryUpdate, lista)
            .then(
                rez => {
                    console.log(rez.rowCount);
                    if (rez.rowCount==0){
                        res.render("pagini/profil",{mesaj:"Update-ul nu s-a realizat. Verificati parola introdusa."});
                        return;
                    } else {
                        req.session.utilizator.nume = campuriText.nume;
                        req.session.utilizator.prenume = campuriText.prenume;
                        req.session.utilizator.email = campuriText.email;
                        req.session.utilizator.culoare_chat = campuriText.culoare_chat;
                    }
                    res.render("pagini/profil",{mesaj:"Update-ul s-a realizat cu succes."});
                    trimiteMail(req.session.utilizator.email, "Noile tale date", "Profilul tau a fost actualizat. Noile tale date sunt:", `<br><br>Nume: ${req.session.utilizator.nume} <br> Prenume: ${req.session.utilizator.prenume} <br> Email: ${req.session.utilizator.email}`);
                },
                err => {
                    console.log(err);
                    res.render("pagini/eroare_generala",{text:"Eroare baza date. Incercati mai tarziu."});
                }
            );
        }

    })
    formular.on("field", function(nume, val) {
        console.log("INTRA AICI LA FIELD");
    })
    formular.on("fileBegin", function(nume, fisier) {
        console.log("INTRA AICI LA FILEBEGIN");
        console.log("CALEUTILIZ");
        caleUtiliz = path.join(__dirname, "poze_uploadate", req.session.utilizator.username);
        console.log("CALEUTILIZ");
        console.log(caleUtiliz);
        if(fs.existsSync(caleUtiliz)) {
            fs.rmdirSync(caleUtiliz, {
                recursive: true,
            });
        }
        console.log("Director sters");
        fs.mkdirSync(caleUtiliz);
        let extensieFisier = fisier.originalFilename.split(".")[1];
        numeFisier = path.join(caleUtiliz, `poza.${extensieFisier}`);
        console.log(numeFisier);
        fisier.filepath = numeFisier;
    })
    formular.on("file", function(nume, fisier) {
        console.log("INTRA AICI LA FILE");
    })
});


app.get("/logout", function(req, res) {
    req.session.destroy();
    res.locals.utilizator = null;
    console.log("LOGOUT");
    res.render("pagini/logout");
});

app.get("/confirmare_inreg/:token1/:utilizator/:token2", function(req, res) {
    var comandaUpdate = `update utilizatori set confirmat_mail=true where username = $1 and cod = $2`;
    var cod = req.params.token1 + req.params.token2;
    var utiliz = req.params.utilizator.split("").reverse().join("");

    console.log(cod);
    console.log(utiliz);
    client.query(comandaUpdate, [utiliz, cod])
    .then(
        rezUpdate => {
            if (rezUpdate.rowCount == 1 && req.params.token1.match(new RegExp("^([0-9]){10}$")) && req.params.token2.match(new RegExp(`^(${utiliz}-)([A-P]){70}$`))) {
                res.render("pagini/confirmare.ejs");
            } else {
                randeazaEroare(res, 2, "Eroare link confirmare", "Nu e userul/linkul corect");
            } 
        }, 
        err => {
            console.log(err);
            randeazaEroare(res, 2);
        }
    );
});

app.get("/admini_online", function(req, res) {
    client.query("select username, email from utilizatori where id in (select distinct user_id from accesari) and rol='admin'", function(err, rezSelect) {
        if(err)
            console.log(err);
        res.send(JSON.stringify(rezSelect.rows));
    });
})

// ------------------------- admin -----------------------------------------
app.get("/useri", function(req, res){
    if (req.session.utilizator && req.session.utilizator.rol == "admin") {
        client.query("select * from utilizatori order by id", function(err, rezQuery){
            console.log(err);
            console.log(rezQuery);
            res.render("pagini/useri", {useri: rezQuery.rows});
        });
    } else {
        randeazaEroare(res, 403);
    }
});

/*app.post("/sterge_utiliz", function(req, res) {
    if (req.session.utilizator && req.session.utilizator.rol == "admin") {
        var formular = new formidable.IncomingForm();
        formular.parse(req, function(err, campuriText, campuriFisier) {
            client.query(`delete from utilizatori where id=$1`, [campuriText.id_utiliz])
            .then(rezDelete => {
                res.redirect("/useri");
            });
        });
    }
});*/

app.post("/stergecont", function(req, res) {
    if (req.session.utilizator) {
        var formular = new formidable.IncomingForm();
        formular.parse(req, function(err, campuriText, campuriFisier) {
            var criptareParola=crypto.scryptSync(campuriText.parola,obGlobal.parolaServer, 64).toString('hex');
            client.query("delete from utilizatori where id=$1 and parola=$2", [req.session.utilizator.id, criptareParola])
            .then(rezDelete => {
                if (rezDelete.rowCount == 0) {
                    res.render("pagini/stergere",{mesaj:"Stergerea nu s-a realizat. Verificati parola introdusa."});
                    return;
                } else {
                    trimiteMail(req.session.utilizator.email, "Contul tau a fost sters.", `Ne pare rau ca nu mai esti clientul nostru, ${req.session.utilizator.username}!`);
                    req.session.destroy();
                    res.locals.utilizator = null;
                    res.redirect("/");
                }
            });
        })
    }
})

app.post("/blocheaza_utiliz", function(req, res) {
    if (req.session.utilizator && req.session.utilizator.rol == "admin") {
        var formular = new formidable.IncomingForm();
        formular.parse(req, function(err, campuriText, campuriFisier) {
            if (campuriText.blocat == "true") {
                trimiteMail(campuriText.email, "Nu ai fost cuminte, asa ca te-am blocat", "Ai fost blocat!", "");
            }
            client.query("update utilizatori set blocat = not blocat where id=$1", [campuriText.id_utiliz])
            .then(rezUpdate => {{
                res.redirect("/useri");
            }});
        });
    }
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
            pass:"movogqazrbeiuruj"
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

function genereazaToken(user) {
    var token1 = "", token2 = `${user}-`;
    for (let i = 0; i < 10; i ++)
        token1 += obGlobal.sirCifre[Math.floor(Math.random() * obGlobal.sirCifre.length)];
    for (let i = 0; i < 70; i ++)
        token2 += obGlobal.sirAP[Math.floor(Math.random() * obGlobal.sirCifre.length)];
    return token1 + token2;
}

function genereazaLink(user, token) {
    var token1 = token.substr(0, 10);
    var token2 = token.substr(10);
    var revu = user.split("").reverse().join("");
    return `/${token1}/${revu}/${token2}/`;
}

function getIp(req){//pentru Heroku
    var ip = req.headers["x-forwarded-for"];//ip-ul userului pentru care este forwardat mesajul
    if (ip){
        let vect=ip.split(",");
        return vect[vect.length-1];
    }
    else if (req.ip){
        return req.ip;
    }
    else{
     return req.connection.remoteAddress;
    }
}

// ============== cos virtual =================
app.post("/produse_cos", function(req, res) {
    console.log(req.body);
    if (req.body.ids_prod.length != 0) {
        let querySelect = `select nume, descriere, pret, gramaj, imagine from prajituri where id in (${req.body.ids_prod.join(",")})`;
        client.query(querySelect, function(err, rezQuery) {
            if (err) {
                console.log(err);
                res.send("Eroare baza de date");
            }
            res.send(rezQuery.rows);
        })
    } else {
        res.send([]);
    }
})

app.listen(obGlobal.port);
console.log("A pornit");

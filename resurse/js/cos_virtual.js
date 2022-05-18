window.addEventListener("load",function(){
	prod_sel = localStorage.getItem("cos_virtual");
	if (prod_sel) {
		var vect_ids=prod_sel.split(",");
		fetch("/produse_cos", {		

			method: "POST",
			headers:{'Content-Type': 'application/json'},
			
			mode: 'cors',		
			cache: 'default',
			body: JSON.stringify({
				ids_prod: vect_ids
			})
		})
		.then(function(rasp){ console.log(rasp); x=rasp.json(); console.log(x); return x})
		.then(function(objson) {
	
			console.log(objson);
			let main = document.getElementsByTagName("main")[0];
			let btn = document.getElementById("cumpara");

			for (let prod of objson){
				let article = document.createElement("article");
				article.classList.add("cos-virtual");
				var h2 = document.createElement("h2");
				h2.innerHTML = prod.nume;
				article.appendChild(h2);
				let imagine = document.createElement("img");
				imagine.src = "/resurse/imagini/produse/" + prod.imagine;
				article.appendChild(imagine);

				let descriere = document.createElement("p");
				descriere.innerHTML = prod.descriere + " <b>Pret: </b>" + prod.pret;
				article.appendChild(descriere);
				main.insertBefore(article, btn);
				
				/* TO DO 
				pentru fiecare produs, creăm un articol in care afisam imaginea si cateva date precum:
				- nume, pret, imagine, si alte caracteristici

				
				document.getElementsByTagName("main")[0].insertBefore(divCos, document.getElementById("cumpara"));
				*/
			}
	
		}
		).catch(function(err){console.log(err)});



/*
		document.getElementById("cumpara").onclick=function(){
				//TO DO: preluare vector id-uri din localStorage

			fetch("/cumpara", {		
	
				method: "POST",
				headers:{'Content-Type': 'application/json'},
				
				mode: 'cors',		
				cache: 'default',
				body: JSON.stringify({
					ids_prod: 0,
				})
			})
			.then(function(rasp){ console.log(rasp); return rasp.text()})
			.then(function(raspunsText) {
		   
				console.log(raspunsText);
				//Ștergem conținutul paginii
				//creăm un paragraf în care scriem răspunsul de la server
				//Dacă utilizatorul e logat și cumpărarea a reușit, 
				
				let p=document.createElement("p");
				p.innerHTML=raspunsText;
				document.getElementsByTagName("main")[0].innerHTML="";
				document.getElementsByTagName("main")[0].appendChild(p)
				if(!raspunsText.includes("nu sunteti logat"))
					localStorage.removeItem("produse_selectate");
		   
			}
			).catch(function(err){console.log(err)});
		}
		*/
	}
	else{
		document.getElementsByTagName("main")[0].innerHTML="<p>Nu aveti nimic in cos!</p>";
	}
	
	
});
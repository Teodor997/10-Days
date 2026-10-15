# 10-Days — versiunea 1.2.0

Evidența paleților pe locații, pentru depozitele Orkla și Douglas, prin scanare cu Zebra MC3300x. Aceeași aplicație rulează pe scanner și pe PC. Scanarea merge mereu, cu sau fără internet. Cât timp fișierul `config.js` nu conține o configurație Firebase, aplicația lucrează doar local și datele se adună prin fișiere de transfer. Cu Firebase configurat, mișcările ajung în timp real pe toate dispozitivele conectate (secțiunea 9).

## Ce este în pachet

| Fișier | Rol |
|---|---|
| `index.html` | aplicația (toată interfața și logica) |
| `sw.js`, `manifest.webmanifest`, `icons/` | fac aplicația instalabilă și disponibilă fără internet |
| `vendor/xlsx.full.min.js` | citirea și scrierea fișierelor Excel |
| `vendor/firebase-*.js` | biblioteca Firebase, folosită doar în modul online |
| `config.js` | configurația instalării: aici se pune configurația Firebase |
| `firestore.rules` | regulile de acces care se lipesc în consola Firebase |
| `sablon-import-miscari.xlsx` | model pentru importul de mișcări și de stoc inițial |
| `sablon-comanda.xlsx` | model pentru încărcarea unei comenzi de picking |

## 1. Publicare (o singură dată)

Aplicația trebuie servită prin HTTPS ca să poată fi instalată și să meargă offline. Varianta folosită și la aplicația de recepții este GitHub Pages:

1. Creează un repository nou (de exemplu `stoc-paleti`) și încarcă în el **conținutul** acestui pachet, cu `index.html` în rădăcină.
2. Settings → Pages → Source: „Deploy from a branch", branch `main`, folder `/ (root)`.
3. După un minut aplicația este la `https://<cont-sau-organizatie>.github.io/stoc-paleti/`.

De știut: pe planul gratuit, GitHub Pages cere repository public. Codul aplicației devine vizibil, dar în el nu există niciun fel de date: stocul și mișcările rămân doar pe dispozitive.

## 2. Instalare pe scanner și pe PC

Pe fiecare MC3300x, cu Wi-Fi pornit o singură dată:

1. Deschide adresa în Chrome.
2. Meniul ⋮ → „Adaugă pe ecranul de pornire" / „Instalează aplicația".
3. Pornește aplicația de pe ecranul de pornire, scrie numele dispozitivului (ex. „Scanner Orkla") și alege depozitul.

Din acest moment aplicația pornește și fără internet. Pe PC se deschide aceeași adresă în Chrome sau Edge (se poate instala la fel, din bara de adrese).

## 3. Setarea scannerului (DataWedge)

Aplicația primește codul ca text tastat, deci merge cu profilul implicit DataWedge (`Profile0`), fără dezvoltare suplimentară. Recomandat:

- DataWedge → Profile0 → **Keystroke output**: activat (este implicit).
- Keystroke output → **Basic data formatting** → bifează **Send ENTER key**.

Fără „Send ENTER key" aplicația tot funcționează: recunoaște un cod venit de la scanner după viteză și îl confirmă singură (opțiunea „Confirmă singur codul scanat" din Setări). Cu Enter este mai rapid și mai sigur.

Tastatura de pe ecran este ascunsă pe pagina de scanare; butonul cu tastatură o afișează când vrei să tastezi un cod de mână.

## 4. Scanarea

Depozitul activ este afișat permanent în bara de sus (Orkla și Douglas au culori diferite). Fiecare operațiune are culoarea ei.

| Mod | Ce scanezi | Ce se întâmplă |
|---|---|---|
| **Intrare** | paletul, apoi locația (merge și invers) | paletul intră în stocul depozitului activ, pe locația scanată |
| **Ieșire** | paletul | paletul iese din stoc către destinația aleasă (implicit TC); contorul arată câți paleți ai scanat |
| **Mutare** | paletul (sau locația lui), apoi locația nouă | paletul se mută; locația veche se eliberează |
| **Verifică** | o locație sau un palet | vezi dacă locația e liberă sau ce palet figurează pe ea; pentru palet, unde se află |

Reguli aplicate:

- Pe etaje: un singur palet pe locație. Dacă locația e deja ocupată, aplicația întreabă. Dacă operatorul confirmă, paletul vechi rămâne în stoc „fără locație" și apare separat în raport, ca să fie căutat.
- Pe parter (vezi secțiunea 4a): mai mulți paleți pe locație, cu confirmare prin scanare.
- Locațiile necunoscute nu sunt blocate: orice cod scanat ca locație este acceptat.
- Etichetele de palet: SSCC simplu (18 cifre), SSCC cu prefix `00`, GS1-128 cu mai multe câmpuri (se rețin și lotul, data de expirare, cantitatea, dacă există) sau orice altă etichetă internă. Nimic nu este respins.
- Situațiile neobișnuite cer confirmare pe ecran, cu sunet diferit: palet deja în stoc, palet care nu figurează în stoc, palet din celălalt depozit. O ieșire scanată a doua oară este semnalată ca eroare.
- Fiecare mișcare are data, ora și numele dispozitivului. Nu există utilizatori.
- Corecții: butonul „Anulează" de lângă ultima scanare sau, pentru orice mișcare mai veche, din pagina Mișcări. Mișcarea anulată rămâne vizibilă în jurnal, tăiată.

## 4a. Locațiile de parter

Parterul se recunoaște după terminația codului de locație, setată în Setări → „Locații de parter": Orkla `-0` (ex. `A1-37-01-0`), Douglas `1` (ex. `G1H001A1`). Setarea este comună tuturor dispozitivelor.

Pe o locație de parter pot sta mai mulți paleți. Când se adaugă un palet (intrare sau mutare) pe o locație care are deja paleți:

1. Aplicația afișează paleții care figurează acolo și cere scanarea fiecăruia.
2. Pentru un palet care nu se găsește fizic se apasă **Lipsă**: paletul este mutat pe locația **Lost** (rămâne în stoc, apare în Stoc cu filtrul „Doar Lost" și ca indicator).
3. După ce toți paleții sunt confirmați sau marcați lipsă, paletul nou este înregistrat. Până atunci nu se salvează nimic; **Renunță** anulează tot.

La ieșire sau la mutarea unui palet de pe parter nu se cere confirmare. Mutările făcute manual de pe PC (Detalii palet → Mută) nu cer confirmare prin scanare. Un palet de pe Lost se readuce în stoc scanându-l la Intrare pe locația unde a fost găsit.

## 4b. Comenzi de picking (doar online)

Pe PC, pagina **Comenzi**:

1. Încarcă un Excel/CSV cu coloanele `Comanda`, `SSCC`, `Destinatie` (șablonul `sablon-comanda.xlsx`). Numărul comenzii și destinația se pot scrie doar pe primul rând al comenzii; rândurile următoare le preiau. Fără coloana Comanda, numele fișierului devine numărul comenzii.
2. Fiecare SSCC trebuie să fie în stoc (nu pe Lost). O comandă cu paleți lipsă este respinsă cu lista erorilor; celelalte comenzi din fișier se creează. Paleții din depozite diferite devin comenzi separate, cu același număr.
3. **Alocă**: bifezi scannerele care văd comanda (mai multe, dacă vrei; progresul e comun). Nimic bifat = orice scanner din depozitul comenzii.
4. **Detalii** arată fiecare palet cu starea lui, cine l-a preluat și când; se poate exporta în Excel. **Închide** scoate comanda de pe scannere (se poate redeschide).

Pe scanner, pagina **Comenzi** arată comenzile deschise alocate lui (sau nealocate, din depozitul lui). Deschizi comanda și:

- aplicația propune paletul următor în ordinea locațiilor; se poate scana orice palet din comandă, în orice ordine;
- scanarea paletului înseamnă **ieșire imediată** către destinația comenzii;
- un palet din afara comenzii este respins; scanarea unei locații spune ce paleți din comandă sunt acolo;
- **Negăsit** marchează paletul; rămâne în stoc, iar comanda se poate termina fără el. Dacă e găsit ulterior, se scanează și devine preluat;
- când toți paleții sunt preluați sau negăsiți, comanda apare „terminată" pe PC și dispare de pe scannere.

Scanarea într-o comandă merge și fără semnal, dacă comanda a fost deja primită pe scanner; ieșirile pleacă la revenirea conexiunii, iar progresul de pe PC se actualizează atunci.

## 5. Pe PC

- **Stoc** și **Mișcări** arată depozitul activ, cel ales în stânga sus. Când schimbi depozitul, se schimbă și ce vezi. Pentru o privire de ansamblu, alege „Toate" la filtrul Depozit.
- **Stoc**: paleții, cu filtrare și căutare; vederea „Locații" arată locațiile libere, ocupate și conflictele. Export Excel sau CSV pentru ce este filtrat.
- **Mișcări**: jurnalul, cu filtre pe perioadă, tip și depozit, export și anulare. Un transfer între depozite apare la amândouă.
- **Date → Import mișcări**: încarcă intrări, ieșiri și mutări din Excel sau CSV. Stocul inițial se încarcă la fel (un rând pe palet). Înainte de import vezi fiecare rând cu starea lui.
- **Date → Raport complet**: un fișier Excel cu trei foi (Stoc, Mișcări, Locații).
- **Date → Lista de locații** (opțional): dacă încarci locațiile fiecărui depozit, raportul arată și locațiile libere nefolosite încă.

### Formatul fișierului de import

Prima linie este antetul. Doar coloana Palet este obligatorie.

| Coloană | Valori |
|---|---|
| Tip | `Intrare`, `Iesire`, `Mutare` (lipsă = tipul ales în aplicație, implicit Intrare) |
| Palet (sau SSCC) | codul paletului, **formatat ca Text în Excel** |
| Depozit | `Orkla` sau `Douglas` (lipsă = depozitul ales în aplicație) |
| Locatie | codul locației |
| Data | `zz.ll.aaaa hh:mm` sau dată Excel (lipsă = momentul importului) |
| Destinatie | pentru ieșiri (lipsă = destinația implicită) |
| Observatii | text liber |

Atenție la SSCC în Excel: dacă celula este numerică, Excel păstrează doar 15 cifre și restul se pierd. Aplicația detectează situația și respinge rândul cu explicație. Formatează coloana ca Text înainte de a lipi codurile.

Același fișier încărcat a doua oară nu dublează stocul: rândurile deja existente sunt sărite.

## 6. Transferul între dispozitive (cât timp aplicația este offline)

Fiecare dispozitiv își ține propriile date. Ca să le aduni:

1. Pe scanner: Date → **Salvează fișierul de transfer**. Fișierul `.json` ajunge în Descărcări.
2. Adu fișierul pe PC (cablu USB, e-mail, Teams).
3. Pe PC: Date → **Încarcă fișiere de transfer** (poți alege mai multe odată).
4. Ca scannerele să vadă și ele tot stocul: salvează fișierul de transfer de pe PC și încarcă-l pe fiecare scanner.

Mișcările identice nu se dublează, deci nu contează dacă încarci același fișier de două ori. Ordinea mișcărilor este dată de ora fiecărui dispozitiv: ține ceasurile scannerelor și al PC-ului pe ora automată.

Recomandare: fă transferul cel puțin o dată pe schimb. Un punct roșu pe „Date" apare când dispozitivul are mișcări nesalvate în fișier de peste 20 de ore.

## 7. Limite și riscuri ale versiunii offline

- **Datele există doar pe dispozitiv.** Dacă se șterg datele Chrome, se dezinstalează aplicația sau scannerul este resetat de IT, mișcările nesalvate în fișier se pierd. Fișierul de transfer este și copia de siguranță.
- **Fără sincronizare, două dispozitive nu se văd.** Un palet mutat în Douglas nu apare pe scannerul din Orkla până la următorul transfer. Verificările „palet deja în stoc" și „locație ocupată" se fac doar pe datele dispozitivului respectiv.
- **Capacitate.** Aplicația a fost testată cu 60.000 de mișcări (recalculare sub o secundă). Găzduirea pe GitHub Pages nu este o limită: pachetul are aproximativ 1 MB față de limita de 1 GB a unui site.

## 8. Actualizări

La o versiune nouă, înlocuiești fișierele din repository cu cele din pachetul nou. La următoarea deschidere cu internet, aplicația anunță „Există o versiune nouă" și se actualizează la apăsarea butonului. Datele de pe dispozitiv nu sunt atinse.

## 9. Modul online (Firebase)

### Cum funcționează

- Fiecare scanare se salvează întâi pe dispozitiv, apoi pleacă pe server. Fără semnal, scanarea merge la fel; mișcările așteaptă și pleacă singure când revine conexiunea.
- Celelalte dispozitive conectate primesc mișcarea în aproximativ o secundă.
- Starea se vede permanent în bara de sus: **sincronizat**, **N de trimis**, **fără conexiune**, **neconectat** sau **eroare sincronizare**. O atingere pe ea deschide detaliile.
- Depozitele, destinațiile și lista de locații sunt și ele comune.
- Verificările „palet deja în stoc" și „locație ocupată" se fac pe datele pe care dispozitivul le are în acel moment. Un scanner fără semnal nu vede ce s-a scanat între timp în altă parte.

### Activare (o singură dată)

1. Creează proiectul în consola Firebase: Firestore Database (locație `europe-west3`, „production mode") și Authentication cu metoda Email/Password.
2. În Authentication → Users adaugă utilizatorul `depozit@stoc.local` cu o parolă. Parola este **codul de acces** al dispozitivelor. Pe scannerele cu tastatură numerică este mai comod un cod doar din cifre, de cel puțin 8 cifre.
3. Firestore Database → Rules: șterge ce este acolo, lipește conținutul fișierului `firestore.rules` și apasă **Publish**. La versiunea 1.2.0 regulile trebuie republicate (au apărut colecțiile `orders` și `devices`).
4. Pune configurația proiectului în `config.js` (în locul lui `null`) și încarcă fișierul în repository.
5. Pe fiecare dispozitiv: deschide aplicația cu internet, introdu codul de acces. Rămâne conectat și după repornire.

Înainte de conectare: dacă pe dispozitiv sunt mișcări de test, șterge-le din Setări → „Șterge toate datele de pe dispozitiv". Tot ce se află pe dispozitiv în momentul conectării este trimis în baza comună.

Stocul inițial se importă o singură dată, de pe un singur dispozitiv conectat (de preferat PC-ul). Ajunge automat pe celelalte.

### Încadrarea în planul gratuit (Spark)

| | Estimat (600 de mișcări pe zi, 3 dispozitive) | Limita gratuită |
|---|---|---|
| Scrieri pe zi | cel mult 600 (+ câteva pe comandă) | 20.000 |
| Citiri pe zi | aproximativ 2.000 | 50.000 |
| Stoc inițial de 3.000 de paleți | 12 scrieri (mișcările se grupează) | 20.000 |
| Stocare | aproximativ 50 MB pe an | 1 GB |
| Trafic de date | sub 1 GB pe lună | 10 GB pe lună |

Dacă o limită zilnică ar fi totuși atinsă, sincronizarea se oprește până a doua zi, dar scanarea continuă și nimic nu se pierde: mișcările rămân pe dispozitiv și pleacă după resetarea limitei. De urmărit pe termen lung: un dispozitiv instalat de la zero citește tot istoricul (aproximativ 2.000 de documente pentru fiecare an de lucru), deci după mulți ani istoricul ar trebui arhivat.

### Repornire de la zero (după perioada de teste)

1. În consola Firebase: Firestore Database → colecția `log` → meniul ⋮ → **Delete collection**.
2. Pe fiecare dispozitiv: Setări → „Șterge toate datele de pe dispozitiv".
3. Importă din nou stocul inițial de pe PC.

Ordinea contează: un dispozitiv neșters ar păstra mișcările vechi.

### Siguranță

Fără codul de acces nimeni nu poate citi sau scrie date, chiar dacă are adresa aplicației și configurația din `config.js` (aceasta nu este secretă). Regulile nu permit ștergerea mișcărilor de pe server. Fișierul de transfer din pagina Date rămâne disponibil ca o copie de siguranță.

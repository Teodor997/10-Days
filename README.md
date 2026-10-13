# Stoc Paleți — versiunea 1.0.0 (offline)

Evidența paleților pe locații, pentru depozitele Orkla și Douglas, prin scanare cu Zebra MC3300x. Aceeași aplicație rulează pe scanner și pe PC. Această versiune lucrează fără internet: datele stau pe fiecare dispozitiv și se adună prin fișiere de transfer. Sincronizarea în timp real (Firebase) este etapa următoare.

## Ce este în pachet

| Fișier | Rol |
|---|---|
| `index.html` | aplicația (toată interfața și logica) |
| `sw.js`, `manifest.webmanifest`, `icons/` | fac aplicația instalabilă și disponibilă fără internet |
| `vendor/xlsx.full.min.js` | citirea și scrierea fișierelor Excel |
| `sablon-import-miscari.xlsx` | model pentru importul de mișcări și de stoc inițial |

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

- Un singur palet pe locație. Dacă locația e deja ocupată, aplicația întreabă. Dacă operatorul confirmă, paletul vechi rămâne în stoc „fără locație" și apare separat în raport, ca să fie căutat.
- Locațiile necunoscute nu sunt blocate: orice cod scanat ca locație este acceptat.
- Etichetele de palet: SSCC simplu (18 cifre), SSCC cu prefix `00`, GS1-128 cu mai multe câmpuri (se rețin și lotul, data de expirare, cantitatea, dacă există) sau orice altă etichetă internă. Nimic nu este respins.
- Situațiile neobișnuite cer confirmare pe ecran, cu sunet diferit: palet deja în stoc, palet care nu figurează în stoc, palet din celălalt depozit. O ieșire scanată a doua oară este semnalată ca eroare.
- Fiecare mișcare are data, ora și numele dispozitivului. Nu există utilizatori.
- Corecții: butonul „Anulează" de lângă ultima scanare sau, pentru orice mișcare mai veche, din pagina Mișcări. Mișcarea anulată rămâne vizibilă în jurnal, tăiată.

## 5. Pe PC

- **Stoc**: paleții din ambele depozite, cu filtrare și căutare; vederea „Locații" arată locațiile libere, ocupate și conflictele. Export Excel sau CSV pentru ce este filtrat.
- **Mișcări**: jurnalul complet, cu filtre pe perioadă, tip și depozit, export și anulare.
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

## 9. Etapa următoare: online

Jurnalul de mișcări este deja construit pentru sincronizare (fiecare mișcare are identificator unic și se poate îmbina fără dubluri). Pentru varianta în timp real este nevoie de un proiect Firebase; aplicația va continua să meargă și fără semnal, trimițând mișcările când revine conexiunea.

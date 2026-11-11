# Status Comenzi — aplicație web

Înlocuiește registrul Excel „Status Comenzi 2026_2.xlsm” și fișierul „Status Incarcari”:
comenzi, statusuri, import borderou Kandia, Adrese, Nr AUTO, confirmarea încărcării, borderou de încărcare.

## Ce conține pachetul

| Fișier | Rol |
|---|---|
| `index.html`, `js/` | aplicația |
| `config.js` | configurația proiectului Firebase (goală = mod demonstrație) |
| `firestore.rules` | regulile de acces, de lipit în consola Firebase |
| `firestore.indexes.json` | excepțiile de indexare (opțional, vezi pasul 4) |
| `manifest.json` | pentru „Adaugă pe ecranul principal” pe telefon / PDA |

## Probă rapidă, fără niciun cont

Deschide `index.html` în Edge sau Chrome. Cu `config.js` gol, aplicația pornește în **mod demonstrație**:
creezi un administrator, apoi din *Administrare → Migrare din Excel* încarci registrul `.xlsm`.
Datele rămân doar în acel browser, deci este bun pentru probă, nu pentru lucru în echipă.

## Punere în funcțiune (o singură dată)

1. **Proiect Firebase** — console.firebase.google.com → *Add project* (fără Google Analytics).
2. **Authentication** → *Get started* → *Sign-in method* → activează **Email/Password**.
3. **Firestore Database** → *Create database* → locație `eur3 (Europe)` → *Production mode*.
   Apoi tabul **Rules**: șterge tot, lipește conținutul din `firestore.rules`, *Publish*.
4. **Excepții de indexare** (recomandat, 2 minute): Firestore → *Indexes* → *Single field* → *Add exemption*:
   colecția `comenzi`, câmpul `o`, dezactivează toate opțiunile. Repetă pentru `adrese` / `r` și `jurnal` / `e`.
   Fără acest pas aplicația merge la fel, dar ocupă de câteva ori mai mult spațiu.
5. **Aplicația web** — *Project settings* → *Your apps* → `</>` → înregistrează aplicația și copiază valorile
   din `firebaseConfig` în `config.js`.
6. **GitHub Pages** — încarcă toate fișierele într-un repository, *Settings → Pages → Deploy from branch → main / root*.
7. **Prima deschidere** — aplicația cere crearea administratorului (numele tău + PIN de 6 cifre).
   Fă acest pas imediat după publicare: primul care deschide pagina devine administrator.
8. **Migrare** — *Administrare → Migrare din Excel* → alege `Status Comenzi 2026_2.xlsm`.
9. **Utilizatori** — *Administrare → Utilizatori*: nume, PIN, rol.

În ziua trecerii de pe Excel rulează din nou migrarea cu ultima versiune a registrului: înlocuiește tot ce e în aplicație.

## Roluri

| Rol | Ce poate face |
|---|---|
| **Administrator** | Tot: utilizatori, migrare, arhivare, jurnal, plus tot ce pot celelalte roluri. |
| **Operator date** | Toată partea de comenzi: adaugă manual, modifică orice câmp al comenzii, schimbă statusuri, importă borderoul Kandia, fișiere Excel și fișierul de transport din TMS; editează Adrese. Nu confirmă încărcări. |
| **Încărcări** | Taburile *Încărcări* și *KPI's*: confirmă camioanele (stare camion, temperatură, semnătură) și tipărește borderoul. |
| **Transport** | Vede comenzile și încărcările; poate modifica doar **Nr AUTO**, direct din lista de comenzi, cât timp comanda nu e încărcată. |

**Jurnal.** Fiecare modificare rămâne în *Administrare → Jurnal de modificări*: cine, când, comanda, câmpul,
valoarea veche → valoarea nouă. Jurnalul nu poate fi șters sau citit decât de administrator.

**Unde sunt impuse drepturile.** Regulile bazei de date împart utilizatorii în trei trepte: cine poate crea comenzi și
modifica adrese (Administrator, Operator date), cine poate doar modifica comenzi existente (Încărcări, Transport) și cine
administrează. Limitarea *pe câmp* (Transport doar Nr AUTO, Încărcări doar confirmarea) este impusă de aplicație.

## Regulile preluate din Excel

- Statusuri: Initiata, In lucru, Terminata, Self-Pick, Anulata, cu aceleași întrebări și culori.
- Terminata / Self-Pick: paleți reali, amprente, greutate finală; KANDIA = greutate + paleți × 20 kg, ceilalți manual
  (cu avertisment la peste 5× greutatea comenzii); toleranță ±1 palet față de estimare.
- FPP și Pick (paleți full / paleți din picking): la completarea FPP, Pick se propune singur (estimarea rotunjită în sus − FPP;
  după terminare, paleți reali − FPP). La Terminata / Self-Pick ambele se confirmă obligatoriu și rămân modificabile după.
- Anulata: se șterg datele comenzii, rămân Nr Crt, client, număr comandă și eticheta de import.
- Comandă manuală: „MANUAL: data ora”, verificare de dublură pe același client, completare din Adrese după Cod Client.
- Import borderou: „Document” = comenzi (EDI), „Nr. aviz” = materiale (EDI MAT); comenzile existente sunt sărite;
  județul din Adrese după destinatar, altfel după oraș (roșu), altfel se cere.
- Încărcată = DA doar pentru comenzi Terminata.

## Ce diferă față de Excel

- Nr Crt vine dintr-un contor unic, deci nu se mai pot dubla numerele când doi colegi adaugă simultan.
- Borderoul nu mai este mutat în „Importate” (un browser nu poate muta fișiere); aplicația ține minte numele
  fișierelor importate și avertizează la reimport.
- Avertisment dacă în borderou rămân rânduri necitite și dacă amprentele depășesc paleții.
- Adresele transformate de Excel în dată („22 Decembrie 1989”) sunt refăcute ca text.
- Încărcarea se confirmă în tabul *Încărcări* (camion → comenzi → stare camion, temperatură, semnătură).

## Fișierul de transport (TMS)

- Se importă din *Încărcări → Import fișier transport (TMS)*, de către Administrator sau Operator date.
- Fișierul este cumulativ, așa că se procesează doar transporturile din ultimele 14 zile (și rândurile fără dată).
- Comenzile găsite în registru primesc Nr AUTO, Nr transport, șofer, remorcă și data transportului.
- Rândurile care **nu există în registru** nu intră în tabul Comenzi: merg în rubrica „Doar din transport” din tabul
  Încărcări, apar la camionul lor și în borderou. Paleții și greutatea lor vin din TMS (`UnitatiTotale`, `MasaTotala`)
  și pot fi corectate acolo; amprentele se completează manual.
- Ora de început a încărcării se înregistrează automat la prima tipărire a borderoului (Administrator sau Încărcări);
  ora de sfârșit este confirmarea încărcării. Lista de camioane arată ambele și durata.
- Filtrul „Data încărcării” din tabul Încărcări folosește coloana `DataEstimataIncarcare` din fișier.

## Tabul KPI's
- Vizibil pentru toate rolurile, doar pentru citire. Pe ziua de încărcare aleasă arată: paleții de încărcat (reali la comenzile
  pregătite, estimați la celelalte), împărțirea FPP / Pick, camioanele pe stări și paleții fiecăruia, comenzile pe statusuri,
  greutatea, durata medie de încărcare, abaterea estimării față de real și comenzile active fără camion alocat.
- Se calculează din datele aflate deja în aplicație: nu face citiri suplimentare din Firebase.
- Paleți reali = FPP + Pick la comenzile pregătite; amprentele pornesc de la aceeași sumă și pot fi corectate.

## Consum în planul gratuit Firebase (Spark)

Limite: 50.000 citiri/zi, 20.000 scrieri/zi, 1 GiB stocare, 10 GiB transfer/lună.

Comenzile sunt păstrate în grupe de 25 (un document = o grupă), iar aplicația urmărește în timp real doar grupele
cu comenzi active și pe cele din ultimele 2 zile. Estimare pentru ~270 comenzi/zi și 6 colegi conectați:

| Resursă | Estimare | Limită |
|---|---|---|
| Citiri | 8.000–10.000 / zi | 50.000 / zi |
| Scrieri | 1.000–2.000 / zi | 20.000 / zi |
| Stocare | ~3 MB acum, ~25–30 MB / an | 1 GiB |
| Transfer | 1,5–2 GiB / lună | 10 GiB / lună |

Ce poate apropia aplicația de limite: peste ~25 de colegi conectați simultan, sau mii de comenzi Terminata lăsate
fără confirmare de încărcare (rămân „active”). Pentru al doilea caz există *Administrare → Arhivare*.
La depășire, planul gratuit nu costă nimic: aplicația afișează un mesaj și revine a doua zi dimineață.
Consumul real: consola Firebase → Firestore → *Usage*.

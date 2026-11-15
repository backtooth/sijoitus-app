# Dippivahti

Suomenkielinen, responsiivinen osakedippien seula. GitHub Pages julkaisee staattisen sivun; GitHub Actions hakee hinnat kahdesti päivässä. Ei palvelinta, API-avaimia tai maksullisia riippuvuuksia.

## Näkymä

- Top 5 suurimmat dipit koko seurannasta tai erikseen USA / Suomi.
- Aikavälit: viikko (5 pörssipäivää), kuukausi (21), kolme kuukautta (63).
- Dippi = viimeisin oikaistu päätöskurssi / jakson korkein oikaistu päätöskurssi − 1. Ikkunaan sisältyy vertailupäivä ja seuraavat N havaintoa.
- Kolmen kuukauden hintakäyrä, viimeisin oikaisematon kurssi, hintapäivä ja linkki yhtiön tietoihin.
- Puuttuvan datan kattavuus ja yli 36 tuntia vanhan päivityksen varoitus.
- Jokaisen top 5 -osakkeen alla dipin todennäköinen tai mahdollinen syy, lähdelinkit ja päivämäärät.

## Dipin syyarviot

Jokainen datapäivitys hakee Yahoo Financen uutisotsikot kaikkien markkina- ja aikavälivalintojen top 5 -osakkeiden yhdisteelle. Uutishaku tehdään Actionsissa; selaimesta ei lähetetä uutispyyntöjä eikä API-avainta tarvita.

`config/reviewed-events.json` sisältää lähteistä tarkistettuja suomenkielisiä tapahtumakuvauksia. Niissä on tapahtumapäivä, tarkistusaika, viimeinen voimassaolopäivä ja alkuperäislähteet. Näitä kuvauksia ylläpidetään toimituksellisesti; ajastus ei kirjoita uusia vapaita yhteenvetoja. Vanhentuneita tai valitun laskujakson huippua edeltäviä tapahtumia ei käytetä syynä.

Jos sopivaa tarkistettua tapahtumaa ei ole, sääntöpohjainen luokittelu etsii yhtiön nimeä/tunnusta ja kielteistä tapahtumaa saman uutisotsikon sisältä. Sivulla tämä merkitään **mahdolliseksi syyksi / otsikkotulkinnaksi**, alkuperäinen otsikko näytetään lyhennettynä ja linkitetään lähteeseen. Pelkkä uutinen tai ajallinen yhteys ei todista syy-seuraussuhdetta. Otsikkohaku ei lue koko artikkelia eikä vahvista sen väitteitä. Uutisen pitää ajoittua valitun jakson kurssihuipun jälkeen; haku jättää tulevat ja liian myöhään julkaistut uutiset pois.

Jos perusteltua syytä ei löydy, kortissa lukee **Syy ei varmistunut**. Uutislähteen häiriö merkitään erikseen eikä se estä kurssien julkaisua. Uutislähteen kattavuus erityisesti Suomen pienyhtiöissä on rajallinen. Tarkistetut tapahtumat on uusittava tai korvattava niiden vanhetessa; vanhaa tarinaa ei esitetä automaattisesti uuden laskun selityksenä.

## Seuranta ja rajoitukset

USA: S&P 500 -yhtiöt, joiden lista haetaan jokaisella ajolla [datasets-reposta](https://github.com/datasets/s-and-p-500-companies). Ei koko USA:n pörssiä. Suomi: `config/helsinki.json`-tiedoston 85 osakkeen seurantalista Helsingin pörssistä ja First Northista, ei koko markkina. Listan merkinnät on tarkistettava säännöllisesti yritysjärjestelyjen ja tunnusmuutosten vuoksi. Epäonnistuneet tunnukset raportoidaan JSONissa ja kattavuus näkyy sivulla.

Hinnat: Yahoo Financen epävirallinen chart-rajapinta. Ei saatavuustakuuta. Tarkista lähteen käyttöehdot omaan käyttötarkoitukseesi; tämä on henkilökohtaiseen seurantaan tarkoitettu prototyyppi. Datan uudelleenjakeluoikeuksia ei myönnetä tällä repolla. Oikaistu hinta huomioi osingot ja splitit. Päivän keskeneräinen havainto voi olla mukana, jos lähde palauttaa sille oikaistun hinnan. Historiaa vaaditaan vähintään 64 kelvollista havaintoa ja viimeisimmän hinnan on oltava enintään 7 päivää vanha.

Top 5 sisältää vain laskeneita yhtiöitä, joilla on riittävä tuore historia. Alle 65 % kattavuus kummassa tahansa markkinassa keskeyttää julkaisun. Osittainenkin kattavuus voi vaikuttaa sijoituksiin. Suuri lasku ei yksin tee osakkeesta halpaa tai hyvää sijoitusta; sivu ei anna ostosuosituksia.

## Julkaisu

1. Repon Settings → Pages → Source: **GitHub Actions**.
2. Vie tiedostot `main`-haaraan. Workflow `Update stocks and deploy Pages` hakee datan, ajaa testit ja julkaisee `public`-hakemiston.
3. Sivun osoite: https://backtooth.github.io/sijoitus-app/

Workflow käynnistyy myös käsin Actions → Run workflow sekä päivittäin **08.17 ja 21.17 UTC** (talvella Suomessa 10.17 ja 23.17; kesällä 11.17 ja seuraavan päivän 00.17). GitHubin ajastukset voivat viivästyä. GitHub voi poistaa julkisen repon ajastuksen käytöstä 60 päivän toimettomuuden jälkeen; tarvittaessa ota se uudelleen käyttöön Actionsista. Ajastus on määritelty `.github/workflows/update-and-deploy.yml`-tiedostossa. GitHub Actionsin oma cron huolehtii päivityksistä, erillistä Codex-automaatiota ei tarvita.

Epäonnistunut datahaku ei korvaa aiempaa julkaisua. Ajastettu ajo hakee kaiken datan uudelleen eikä commitoi hintahistoriaa repoon. Tuorein `public/data/stocks.json` sisältyy Pages-julkaisuun. Ensimmäinen julkaisu edellyttää onnistunutta datapäivitystä.

## Paikallinen käyttö

Node.js 24, ei npm-riippuvuuksia:

```sh
npm test
npm run update
npm run dev
```

Avaa http://127.0.0.1:4173 . Datahaku kestää useita minuutteja. Päivitä Suomen seurantalista muokkaamalla `config/helsinki.json`-tiedostoa (tunnukset ilman `.HE`-päätettä).

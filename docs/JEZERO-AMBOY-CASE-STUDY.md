# Kajian kes terrain: Jezero–Amboy

Tarikh: 15 November 2026. Baseline aplikasi: `1209a9e49db69a6d2b9a590e0469065f605ec527`.

**Keputusan:** pasangan ini menyokong contoh latihan analisis terrain serantau
dan perancangan pemerhatian di atas peta. Bukti belum mengesahkan Amboy sebagai
padanan geologi Jezero atau tapak ujian pergerakan rover sebenar. Skor sangat
bergantung pada keluasan dan pusat window yang dipilih. Kajian ini menggunakan
dua dataset sedia ada; tiada modul baharu, perubahan skor atau deployment.

**Research susulan yang lebih luas:** lihat [Earth analog research](EARTH-ANALOG-RESEARCH.md)
untuk enam calon literatur baharu, tiga kawalan yang dimuatkan semula dan dua
belas window carian Idaho. Jezero–Amboy kekal sebagai kajian semakan terdahulu,
bukan pilihan default yang perlu dipertahankan selepas calon diperluas.

## Keadaan sasaran dan kawasan kajian

Keadaan yang dipilih ialah **taburan cerun berskala kilometer dan variasi relief
untuk latihan reconnaissance serta penerangan keputusan perancangan pemerhatian**.
Ini fokus terrain yang terhad dan boleh diukur. Tiada sasaran memadankan semua
keadaan Marikh atau membuktikan proses pembentukan kedua-dua kawasan sama.

| Kawasan | Pusat window projek | Sumber terrain |
| --- | --- | --- |
| Jezero, Marikh | 18.380° N, 77.580° E | NASA MGS MOLA MEGDR, 128 piksel/darjah |
| Wilayah Amboy, Bumi | 34.557° N, 115.780° W | Tile Skadi HGT `N34W116`, sumber elevasi campuran |

Kedua-dua window berukuran nominal 32 × 32 km, dengan 65 × 65 sampel pada sela
500 m dan baseline gradient 1 km. Dimensi mengikut unjuran lokal aplikasi,
bukan jaminan segi empat geodesik tepat di setiap titik. Pusat ialah pilihan
window projek, bukan koordinat rover semasa atau sempadan geologi yang dipetakan.

NASA/JPL menerangkan Jezero sebagai kawah impak dengan sejarah tasik dan delta
berkaitan aliran sungai. BLM mengenal pasti Amboy sebagai kon gunung berapi dan
medan lava. Ini perbezaan proses yang perlu dinyatakan walaupun dua window
menunjukkan beberapa ukuran terrain yang hampir.
Sumber: [NASA/JPL — Jezero](https://www.jpl.nasa.gov/images/pia24350-perseverance-rover-landing-ellipse-in-jezero-crater/),
[BLM — Amboy](https://www.blm.gov/visit/amboy-crater-national-natural-landmark).

## Persamaan yang diukur

| Ukuran pada window 32 km | Jezero | Amboy |
| --- | ---: | ---: |
| Relief dalam window | 1,143.34 m | 986.94 m |
| Cerun purata, baseline 1 km | 2.11° | 2.32° |
| Persentil ke-90 cerun | 5.44° | 5.81° |
| Sampel cerun di bawah 5° | 88.69% | 87.55% |
| Sampel cerun di bawah 10° | 95.89% | 96.78% |

Peratus di atas ialah bahagian daripada **3,969 sampel cerun dalaman**, bukan
peratus tanah boleh dilalui atau tahap kesesuaian misi. Nilai 5° dan 10° ialah
sempadan bin deskriptif aplikasi, bukan had kejuruteraan rover yang disahkan.
Purata yang hampir juga tidak bermaksud taburan cerun serupa tepat:

| Bin cerun | Jezero | Amboy |
| --- | ---: | ---: |
| 0 hingga <2° | 74.23% | 60.29% |
| 2 hingga <5° | 14.46% | 27.26% |
| 5 hingga <10° | 7.21% | 9.22% |
| 10 hingga <20° | 4.11% | 3.22% |
| 20° dan ke atas | 0.00% | 0.00% |

Ketiadaan sampel serantau dalam bin curam tidak membuktikan ketiadaan tebing,
batu, cerun kon atau halangan kecil. Objek tersebut boleh hilang apabila data
dilihat pada sela 500 m dan baseline 1 km.

## Bukti dan pengesahan pengiraan

Indeks default **86.7/100** datang daripada jarak taburan cerun `0.148148` dan
jarak relief `0.106010`, dengan berat cerun `0.65` dan relief `0.35`.
Indeks ini bukan kebarangkalian, peratus padanan saintifik atau kelulusan misi.
Preset navigasi menghasilkan 85.8 dan fieldwork 87.3; preset thermal masih
menggunakan skor terrain yang sama, tanpa memasukkan suhu.

Semakan baharu mendapatkan semula fail sumber **yang sama** dan menyimpan hash:

- Semua 4,225 tinggi Jezero dibina semula tepat daripada strip topografi MOLA
  yang hash dan byte range-nya sepadan dengan rekod produksi. Pembacaan sumber
  menggunakan reader planet yang sudah diuji dalam projek.
- Semua 4,225 tinggi Amboy dibina semula tepat melalui pembacaan HGT big-endian,
  interpolasi bilinear dan pembundaran yang didokumenkan. Hash fail gzip sumber
  sepadan dengan rekod produksi. Tiada no-data diganti dengan tinggi rekaan.
- Pengiraan berasingan daripada fungsi statistik aplikasi mengesahkan relief,
  cerun, histogram dan formula indeks. **9,115 perbandingan numerik lulus**,
  termasuk eksperimen subset di bawah.
- Window Amboy lulus semakan daratan kasar 25/25 dan terperinci 4,225/4,225,
  tanpa segmen pantai bersilang. Ini masih saringan kartografi, bukan inventori
  semua air pedalaman atau kelulusan akses lapangan.

MOLA ialah produk topografi yang dibin daripada altimetri. Fail kiraan sumber
yang diperiksa menunjukkan **3,252 daripada 5,325 bin sokongan unik** mempunyai
kiraan sifar. Sebanyak **1,454 daripada 4,225 sampel grid** menggunakan empat
bin sudut yang kesemuanya berkiraan sifar. Label produk menyatakan tinggi
diinterpolasi apabila bin tiada pemerhatian. Tinggi itu kekal sah sebagai nilai
produk arkib, tetapi bukan ukuran langsung bagi setiap sampel. Kiraan ini
bukan anggaran ralat, ketepatan atau keyakinan analog.
Lihat [dokumentasi MOLA](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html)
dan label asal yang disimpan dalam folder bukti.

Data Amboy ialah derivatif Skadi, bukan fail NASA Earthdata asli. Input AS boleh
menggunakan USGS 3DEP/NED serta sumber lain; posting HGT sekitar 30 m tidak
mengubah sela analisis kita menjadi 30 m atau menjamin ketepatan tersebut.
Sumber dan atribusi: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/),
[Tilezen](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## Kepekaan terhadap keluasan dan pusat

Eksperimen ini hanya mengambil sampel yang sudah ada dalam grid 32 km. Tiada
terrain tambahan, resampling baharu atau peningkatan resolusi dibuat. Kedua-dua
window dalam setiap perbandingan mempunyai keluasan yang sama, sela 500 m dan
baseline cerun 1 km.

| Keluasan | Indeks pada pusat asal | Julat apabila kedua-dua pusat diubah secara berasingan |
| --- | ---: | ---: |
| 32 × 32 km | 86.7 | Tidak diuji di luar grid asal |
| 24 × 24 km | 86.9 | 40.6–94.2 |
| 16 × 16 km | 55.3 | 34.1–98.1 |

Untuk setiap keluasan 16/24 km, setiap pusat dianjak pada grid 5 × 5:
−4, −2, 0, +2 atau +4 km ke timur dan utara. Sebanyak 25 pusat Jezero
dibandingkan dengan 25 pusat Amboy, menghasilkan 625 pasangan bagi setiap
keluasan, atau **1,250 pasangan subset** keseluruhannya.

Subset bertindih dan bukan pemerhatian bebas. Julat ini bukan selang keyakinan,
error bar atau kebarangkalian. Ia mengubah bahagian landskap yang diringkaskan;
ia tidak menganggarkan ralat DEM dan tidak menguji ranking calon Bumi lain.
Tiada ambang baharu ditetapkan untuk melabel skor sebagai analog yang baik.

Penurunan 86.7 kepada 55.3 pada subset 16 km berpusat sama menunjukkan bahawa
persamaan baseline bergantung pada window. Kesimpulan tidak boleh digeneralisasi
kepada semua Jezero, semua Amboy atau kon kecil Amboy. Skor maksimum subset
98.1 juga tidak patut dipilih untuk mendakwa padanan yang lebih sah.

## Kegunaan latihan misi yang dicadangkan

Cadangan berikut ialah **inferens projek daripada terrain**, bukan hasil ujian
lapangan atau pengesahan NASA:

1. **Latihan membaca terrain serantau.** Bandingkan histogram dan peta cerun,
   kemudian jelaskan kawasan pemerhatian yang ingin dinilai dengan data lebih
   halus. Hasilnya ialah peta beranotasi, soalan saintifik dan alasan pemilihan.
2. **Latihan merancang pemerhatian.** Bina urutan hentian hipotetikal di atas peta
   dan nyatakan bukti yang diperlukan sebelum sesuatu laluan boleh diluluskan.
   Ini menilai cara pasukan menggunakan bukti dan melaporkan ketidakpastian,
   bukan keberkesanan tayar, kaki robot atau masa perjalanan sebenar.
3. **Latihan menguji keputusan analisis.** Ulang analisis dengan pusat/keluasan
   berbeza dan dokumentasikan bagaimana pilihan kawasan mengubah keputusan.
   Hasilnya ialah log keputusan yang boleh diulang, bukannya satu skor tinggi.

[Arkib PDS Amboy](https://pds-geosciences.wustl.edu/missions/amboycrater/index.htm)
mendokumenkan fotografi kajian lapangan pada Februari 1976. Ia memberi konteks
bahawa Amboy mempunyai sejarah kajian, bukan bukti bahawa latihan di atas telah
dijalankan untuk Jezero atau bahawa TerraMatch menemui analog baharu.

## Batas analogi

- **Geologi berbeza:** kon dan medan lava Amboy tidak mengesahkan kesetaraan
  dengan sejarah impak, tasik atau delta Jezero. Mineral, sedimen dan biologi
  tidak dinilai oleh dua ukuran terrain ini.
- **Skala objek tidak sepadan dengan grid:** BLM memberikan diameter kon Amboy
  kira-kira 1,500 kaki (457.2 m) dan tinggi 250 kaki (76.2 m). Diameternya kurang
  daripada satu sela grid, sedangkan relief window Amboy hampir 987 m. Indeks
  serantau tidak mengukur bentuk kon tersebut secara terperinci.
- **Bahaya sebenar tidak diukur:** batu, rekahan, permukaan lava, kestabilan tanah
  dan daya cengkaman tidak boleh disahkan daripada grid ini. Gerakan avatar 3D
  tidak membuktikan sesuatu laluan selamat atau boleh dilalui.
- **Persekitaran berbeza:** atmosfera, graviti, radiasi, suhu dan keadaan manusia
  di Bumi tidak dihasilkan semula sebagai keadaan Marikh. Tiada modul ais
  diperlukan untuk mendakwa persamaan terrain yang terhad ini.
- **Tiada kelulusan lapangan:** akses, permit, keadaan semasa dan keselamatan
  belum disahkan; cadangan kajian ini bukan arahan perjalanan atau operasi.

## Keputusan akhir dan reproduksi

Gunakan Jezero–Amboy sebagai **kajian kes desktop bagi perbandingan terrain
serantau dan kesan pemilihan window**. Ia menjawab keadaan yang dikaji, bukti
yang menyokongnya dan latihan yang boleh dicadangkan, sambil mengehadkan dakwaan
kepada apa yang benar-benar diukur. Bukti ini belum mencukupi untuk melabel Amboy
sebagai padanan geologi menyeluruh atau tapak ujian rover Jezero yang disahkan.

Semakan offline:

```sh
node scripts/validate-jezero-amboy.mjs
```

Muat semula hanya sumber asal yang diperlukan, secara sengaja:

```sh
node scripts/validate-jezero-amboy.mjs --fetch-sources
```

Skrip hanya menulis
[folder bukti kajian](research/jezero-amboy-case-2026-11-15/): `results.json`,
`source-manifest.json`, label MOLA, dua strip binari sumber dan fail Skadi asal.
JSON menyimpan semua ukuran, 1,250 pasangan subset, kedudukan subset, hash input
dan metadata sumber. Fingerprint fail produksi disemak sebelum/selepas analisis.
Kod aplikasi, semua dataset produksi dan formula skor kekal tidak berubah.

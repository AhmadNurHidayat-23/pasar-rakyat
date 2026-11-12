# Pasar Rakyat

Pengelolaan pedagang dan kios pasar. Prototipe portofolio independen, bukan aplikasi resmi pemerintah.

## Fitur utama

- CRUD pedagang, blok, kios dan kategori usaha; arsip serta pemulihan untuk menjaga riwayat.
- Penempatan per periode inklusif, status kios menurut tanggal pemantauan dan pencegahan bentrok melalui transaksi serta trigger SQLite.
- Perpindahan atomik, riwayat penempatan, pembatalan, pengingat masa berakhir 30 hari dan CSV okupansi.
- Admin mengelola seluruh data; Petugas mengelola pedagang serta penempatan/perpindahan. Gunakan data demonstrasi tanpa NIK.

## Teknologi

Node.js 22.13+, Express, SQLite, HTML, CSS, JavaScript.

## Cara instalasi

~~~powershell
cd C:\laragon\www\pasar-rakyat
npm install
npm run user
~~~

Buat Admin, lalu ulangi untuk Petugas. Kata sandi 12–200 karakter dimasukkan melalui prompt. Tidak ada akun bawaan.

## Cara menjalankan

~~~powershell
npm start
~~~

Buka http://127.0.0.1:5451. Tanggal awal dan akhir penggunaan inklusif; periode baru harus dimulai setelah tanggal akhir sebelumnya agar tidak beririsan. Perpindahan pada hari pertama membatalkan penempatan asal sambil menyimpan riwayatnya. Tanggal pemantauan mengikuti WIB.

SQLite dibuat otomatis di data/app.sqlite dengan inisialisasi yang aman diulang. APP_DB dapat mengganti lokasi. Set SECURE_COOKIE=1 untuk HTTPS. Tes: npm test.

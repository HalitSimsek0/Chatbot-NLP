# Üniversite Bilgi Tabanlı Doğal Dil İşleme ChatBot Sistemi

## 1. Proje Tanımı

Bu proje, Python kullanılarak geliştirilmiş bir Doğal Dil İşleme (Natural Language Processing – NLP) uygulamasıdır. Projede, BERTürkçe tabanlı bir dil modeli eğitilerek, farazi bir üniversite için üniversiteye ait soruları anlayabilen ve doğru cevaplar üretebilen bir akıllı soru–cevap sistemi (ChatBot) geliştirilmiştir.

Sistem, kullanıcıdan gelen doğal dilde yazılmış soruları analiz etmekte, sorunun anlamını kavramakta ve daha önceden hazırlanmış veri seti üzerinden uygun cevabı üretmektedir. Bu sayede kullanıcılar, üniversite hakkında merak ettikleri akademik, idari veya genel bilgileri doğal dil kullanarak sorgulayabilmektedir.

---

## 2. Doğal Dil İşleme ve Model Eğitimi

Projenin temelini, Türkçe dili için özelleştirilmiş BERTürkçe modeli oluşturmaktadır. BERTürkçe, Türkçe metinlerde anlamsal ilişkileri daha doğru yakalayabilen transformer tabanlı bir dil modelidir.

Bu proje kapsamında:

- Üniversiteye ait bilgilerden oluşan özel bir CSV veri seti hazırlanmıştır.
- Veri seti, soru–cevap formatında düzenlenmiş olup yaklaşık 10.000 satırdan oluşmaktadır.
- Veri kümesi; akademik kadro bilgileri, idari yapılar, genel üniversite bilgileri ve kullanıcıların sık sorabileceği soruları kapsayacak şekilde hazırlanmıştır.
- Model, bu veri seti kullanılarak eğitilmiş ve üniversiteye özgü soruları doğru şekilde anlayabilecek seviyeye getirilmiştir.

Örneğin sistem,
“İskenderun Teknik Üniversitesi rektörü kimdir?”
şeklinde sorulan bir soruyu doğru şekilde analiz ederek, veri seti üzerinden
“Mehmet Duru”
cevabını üretebilmektedir.

Bu yapı sayesinde sistem, üniversitenin resmi internet sayfasında yer alan bilgileri temel alarak mümkün olduğunca kapsamlı bir soru–cevap yeteneği kazanmıştır.

---

## 3. Sistem Mimarisi

Proje, backend (sunucu) ve frontend (kullanıcı arayüzü) olmak üzere iki ana bileşenden oluşmaktadır.

### 3.1 Backend (Python)

- Backend tarafı Python ile geliştirilmiştir.
- Eğitilmiş model, backend üzerinde çalışmakta ve gelen soruları işleyerek cevap üretmektedir.
- Modelin eğitimi, veri işleme ve tahmin (prediction) süreçleri Python tarafında yürütülmektedir.
- Backend, HTTP tabanlı bir Web API üzerinden dış dünyaya servis vermektedir.

### 3.2 Frontend (Web Arayüzü)

- Kullanıcı arayüzü React ve Tailwind CSS kullanılarak geliştirilmiştir.
- React arayüzü, kullanıcıdan alınan soruları backend’e HTTP istekleri ile göndermektedir.
- Backend tarafından üretilen cevaplar tekrar frontend’e iletilerek kullanıcıya gösterilmektedir.
- Bu yapı sayesinde sistem, web tarayıcısı üzerinden erişilebilen modern ve kullanıcı dostu bir arayüz sunmaktadır.

---

## 4. Veri Seti Yapısı

- Veri seti CSV formatında hazırlanmıştır.
- Yaklaşık 10.000 satırlık veri bulunmaktadır.
- Her satır, bir soru ve ona karşılık gelen cevabı içermektedir.
- Veri seti, modelin üniversiteye özgü soruları öğrenebilmesi için özel olarak hazırlanmıştır.

---

## 5. Model Dosyaları ve Sanal Ortam Hakkında Not

Model dosyalarının ve Python sanal ortamının boyutlarının oldukça büyük olması nedeniyle:

- Eğitilmiş model dosyaları
- Python sanal ortamı (venv)

GitHub reposuna eklenmemiştir.

Bunun yerine repoda yalnızca:
- Modelin eğitim kodları
- Backend (API) kaynak kodları
- Frontend (React) arayüz kodları

paylaşılmıştır.

Bu yaklaşım, GitHub depolama sınırları ve profesyonel yazılım geliştirme pratikleri açısından tercih edilmiştir.

---

## 6. Kullanılan Teknolojiler

- Python
- Doğal Dil İşleme (NLP)
- BERTürkçe
- React
- Tailwind CSS
- Web API (HTTP)
- CSV tabanlı veri seti

---

## 7. Sonuç

Bu proje ile, üniversitelere özel olarak eğitilebilen, Türkçe doğal dili anlayabilen ve web tabanlı bir arayüz üzerinden erişilebilen bir akıllı ChatBot sistemi geliştirilmiştir. Sistem, gerçek hayatta üniversitelerin bilgi sunma süreçlerinde kullanılabilecek nitelikte bir altyapı sunmaktadır.



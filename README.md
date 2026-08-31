# manga-publisher-display
ebookjapanなどの電子書籍サービスで出版社名を表示する<br>
自動取得出来なかった、間違っている場合は手動での変更も可能

・必要<br>
Google Books APIのAPIキー
　ー無しだと制限にかかってエラーが出る？

・使い方<br>
１．content.jsの１行目、カンマ内にAPIキーを入力<br>
２．Chromeのっ拡張機能ページで、デベロッパーモードをONにしてフォルダ全体を読み込む

・現在の機能<br>
電子書籍のカート画面で、カート内とあとで買う内の漫画に出版社を表示する。<br>
　ー未判定のタイトルは本/1秒で判定<br>
　ー判定済みのものは拡張機能内データから呼び出す<br>

・対応サイト<br>
ebookjapan, booklive

・今後<br>
bookwalkerなどにも対応できたら

・機能画面<br>
<img width="636" height="479" alt="Image 20260901064548" src="https://github.com/user-attachments/assets/80e48eb4-e64e-4d8c-aaf4-923249aec21d" />
<img width="959" height="505" alt="Image 20260901064518" src="https://github.com/user-attachments/assets/a629b50c-81bc-46fa-ab4f-d8070992c871" />

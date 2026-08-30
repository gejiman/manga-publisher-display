# manga-publisher-display
ebookjapanなどの電子書籍サービスで出版社名を表示する

・必要
Google Books APIのAPIキー
　ー無しだと制限にかかってエラーが出る？

・使い方
１．content.jsの１行目、カンマ内にAPIキーを入力
２．Chromeのっ拡張機能ページで、デベロッパーモードをONにしてフォルダ全体を読み込む

・現在の機能
ebookjapanのカートにて、カート内とあとで買う内の漫画に出版社を表示する。
　ー未判定のタイトルは本/1秒で判定
　ー判定済みのものは拡張機能内データから呼び出す

・今後
Booklive, bookwalkerなどにも対応できたら

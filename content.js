const GOOGLE_BOOKS_API_KEY = '';


//サイトごとに判定
const SITE_CONFIGS = [
  {
    origin: 'https://ebookjapan.yahoo.co.jp',
    path: /^\/cart\/?$/,
    titleSelector: '.book-caption__title',
    publisherParentSelector: '.book-caption'
  },
  {
    origin: 'https://booklive.jp',
    path: /^\/cart\/?$/,
    titleSelector: 'p.book_name',
    publisherParentSelector: '.text'
  }
];

function getSiteConfig( ) {
  return SITE_CONFIGS.find((config) =>
    location.origin === config.origin &&
    config.path.test(location.pathname)
  ) || null;
}


// Google Books APIから出版社名を取得する関数
	//検索用タイトルを正規化
	function normalizeBookTitle(rawTitle) {
	  return rawTitle
	    .replace(/[（(][^）)]*[）)]/g, '')
	    .replace(/[【\[].*?[】\]]/g, '')
	    .replace(/\s*[：:]\s*第?\d+\s*(?:巻|話|冊)?\s*$/u, '')
	    .replace(/\s*第?\d+\s*(?:巻|話|冊)\s*$/u, '')
	    .replace(/\s+/g, ' ')
	    .trim();
	}

	function normalizeForComparison(title) {
	  return title
	    .normalize('NFKC')
	    .replace(/[\s　]/g, '')
	    .replace(/[～?~\-‐???―]/g, '')
	    .replace(/[「」『』【】\[\]（）()]/g, '')
	    .toLowerCase();
	}

// Google Books APIの呼び出しを直列化し、開始間隔を1秒以上にする
const API_REQUEST_INTERVAL_MS = 1000;
let apiRequestQueue = Promise.resolve();
let lastApiRequestStartedAt = 0;

function requestPublisherWithRateLimit(searchTitle) {
  const runRequest = async () => {
    const elapsed = Date.now() - lastApiRequestStartedAt;
    const waitTime = Math.max(0, API_REQUEST_INTERVAL_MS - elapsed);

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    lastApiRequestStartedAt = Date.now();
    return fetchPublisherFromAPI(searchTitle);
  };

  // 前のAPIリクエストが終わってから次を実行する
  const request = apiRequestQueue.then(runRequest, runRequest);

  // 1件の失敗で待ち行列全体が停止しないようにする
  apiRequestQueue = request.catch(() => {});

  return request;
}

//APIを字呼び出す
async function fetchPublisherFromAPI(searchTitle) {
  const params = new URLSearchParams({
    q: `intitle:${searchTitle}`,
    maxResults: '10',
    printType: 'books',
    key: GOOGLE_BOOKS_API_KEY
  });
  const url = `https://www.googleapis.com/books/v1/volumes?${params}`;

  try {
    const response = await fetch(url );
    if (!response.ok) {
      throw new Error(`APIエラー: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const normalizedSearchTitle = normalizeForComparison(searchTitle);

    const candidates = items
      .filter((item) => {
        const info = item.volumeInfo;
        return typeof info?.title === 'string' &&
          typeof info?.publisher === 'string' &&
          info.publisher.trim() !== '';
      })
      .map((item) => ({
        title: item.volumeInfo.title,
        publisher: item.volumeInfo.publisher.trim()
      }));

    const exactMatch = candidates.find(({ title }) =>
      normalizeForComparison(title) === normalizedSearchTitle
    );

    const partialMatch = candidates.find(({ title }) => {
      const normalizedCandidateTitle = normalizeForComparison(title);
      return normalizedCandidateTitle.includes(normalizedSearchTitle) ||
        normalizedSearchTitle.includes(normalizedCandidateTitle);
    });

    const matchedBook = exactMatch || partialMatch;
    return matchedBook
      ? matchedBook.publisher
      : '出版社が見つかりませんでした';
  } catch (error) {
    console.error('API取得エラー:', error);
    return '取得失敗（制限または通信エラー）';
  }
}


//表示関数を追加
function renderPublisherLabel(parentContainer, searchTitle, publisher) {
  let publisherEl = parentContainer.querySelector('.publisher-label');

  if (!publisherEl) {
    publisherEl = document.createElement('div');
    publisherEl.className = 'publisher-label';
    parentContainer.appendChild(publisherEl);
  }

  publisherEl.replaceChildren();

  const textEl = document.createElement('span');
  textEl.textContent = `出版社: ${publisher}`;
  publisherEl.appendChild(textEl);

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = '編集';
  editButton.className = 'publisher-edit-button';
  editButton.style.marginLeft = '8px';

  editButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    // 編集欄がすでに表示されている場合は何もしない
    if (publisherEl.querySelector('.publisher-edit-input')) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'publisher-edit-input';
    input.value = publisher.includes('見つかりませんでした') ||
      publisher.includes('取得失敗') ||
      publisher === '出版社情報なし'
      ? ''
      : publisher;
    input.placeholder = '出版社名';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = '保存';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'キャンセル';

    const editorEl = document.createElement('span');
    editorEl.className = 'publisher-editor';
    editorEl.append(input, saveButton, cancelButton);

    // 現在の表示を編集欄に置き換える
    publisherEl.replaceChildren(editorEl);
    input.focus();

    const cancelEdit = (cancelEvent) => {
      cancelEvent.preventDefault();
      cancelEvent.stopPropagation();
      renderPublisherLabel(parentContainer, searchTitle, publisher);
    };

    const saveEdit = (saveEvent) => {
      saveEvent.preventDefault();
      saveEvent.stopPropagation();

      const newPublisher = input.value.trim();
      if (!newPublisher) {
        input.focus();
        return;
      }

      chrome.storage.local.set(
        { [searchTitle]: newPublisher },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              '出版社情報の保存に失敗しました:',
              chrome.runtime.lastError
            );
            return;
          }

          renderPublisherLabel(
            parentContainer,
            searchTitle,
            newPublisher
          );
        }
      );
    };

    saveButton.addEventListener('click', saveEdit);
    cancelButton.addEventListener('click', cancelEdit);

    input.addEventListener('keydown', (inputEvent) => {
      if (inputEvent.key === 'Enter') {
        saveEdit(inputEvent);
      } else if (inputEvent.key === 'Escape') {
        cancelEdit(inputEvent);
      }
    });
  });

  publisherEl.append(' ', editButton);
}
function renderPublisherLabel(parentContainer, searchTitle, publisher) {
  let publisherEl = parentContainer.querySelector('.publisher-label');

  if (!publisherEl) {
    publisherEl = document.createElement('div');
    publisherEl.className = 'publisher-label';
    parentContainer.appendChild(publisherEl);
  }

  publisherEl.replaceChildren();

  const textEl = document.createElement('span');
  textEl.textContent = `出版社: ${publisher}`;
  publisherEl.appendChild(textEl);

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = '編集';
  editButton.className = 'publisher-edit-button';
  editButton.style.marginLeft = '8px';

  editButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    // 編集欄がすでに表示されている場合は何もしない
    if (publisherEl.querySelector('.publisher-edit-input')) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'publisher-edit-input';
    input.value = publisher.includes('見つかりませんでした') ||
      publisher.includes('取得失敗') ||
      publisher === '出版社情報なし'
      ? ''
      : publisher;
    input.placeholder = '出版社名';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = '保存';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'キャンセル';

    const editorEl = document.createElement('span');
    editorEl.className = 'publisher-editor';
    editorEl.append(input, saveButton, cancelButton);

    // 現在の表示を編集欄に置き換える
    publisherEl.replaceChildren(editorEl);
    input.focus();

    const cancelEdit = (cancelEvent) => {
      cancelEvent.preventDefault();
      cancelEvent.stopPropagation();
      renderPublisherLabel(parentContainer, searchTitle, publisher);
    };

    const saveEdit = (saveEvent) => {
      saveEvent.preventDefault();
      saveEvent.stopPropagation();

      const newPublisher = input.value.trim();
      if (!newPublisher) {
        input.focus();
        return;
      }

      chrome.storage.local.set(
        { [searchTitle]: newPublisher },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              '出版社情報の保存に失敗しました:',
              chrome.runtime.lastError
            );
            return;
          }

          renderPublisherLabel(
            parentContainer,
            searchTitle,
            newPublisher
          );
        }
      );
    };

    saveButton.addEventListener('click', saveEdit);
    cancelButton.addEventListener('click', cancelEdit);

    input.addEventListener('keydown', (inputEvent) => {
      if (inputEvent.key === 'Enter') {
        saveEdit(inputEvent);
      } else if (inputEvent.key === 'Escape') {
        cancelEdit(inputEvent);
      }
    });
  });

  publisherEl.append(' ', editButton);
}

//content.jsにも実行制限を追加(if (!isCartPage()),
function isCartPage() {
  return location.origin === 'https://ebookjapan.yahoo.co.jp' &&
    /^\/cart\/?$/.test(location.pathname );
}


// 画面内の全タイトル要素を処理する関数
function processAllBookTitles() {
  const siteConfig = getSiteConfig();

  if (!siteConfig) {
    return;
  }

  const titleElements = document.querySelectorAll(
    siteConfig.titleSelector
  );


  titleElements.forEach((titleEl) => {
    // すでに処理中または処理済みの場合は即座にスキップ（二重実行を防止）
    if (titleEl.dataset.publisherStatus) return;

    const rawTitle = titleEl.textContent.trim();
    if (!rawTitle) return;

    // 即座に処理中フラグを立てて後続の重複処理をブロック
    titleEl.dataset.publisherStatus = 'processing';
	const searchTitle = normalizeBookTitle(rawTitle);
	const parentContainer =
  	titleEl.closest(siteConfig.publisherParentSelector) ||
 	 titleEl.parentElement;

    // ローカルストレージ（キャッシュ）を確認
    chrome.storage.local.get([searchTitle], async (result) => {
      let publisher = result[searchTitle];

      if (!publisher) {
	publisher = await requestPublisherWithRateLimit(searchTitle);
        // 出版社名を取得できた場合だけキャッシュに保存する
	if (
	  publisher &&
 	 publisher !== '出版社情報なし' &&
	  publisher !== '出版社が見つかりませんでした' &&
	  publisher !== '取得失敗（制限または通信エラー）'
	) {
	  chrome.storage.local.set({ [searchTitle]: publisher });
	}
      }

      // 画面内に重複タグがないか最終確認して表示
	renderPublisherLabel(parentContainer, searchTitle, publisher);

      // 完了ステータスに変更
      titleEl.dataset.publisherStatus = 'done';
    });
  });
}

// 初回実行
processAllBookTitles();

// 画面の変化を監視（デバウンス処理で連続実行を抑制）
let timerId = null;
const observer = new MutationObserver(() => {
  if (!isCartPage()) {
    return;
  }
  if (timerId) clearTimeout(timerId);
  // 画面の変化が落ち着いてから0.5秒後に1回だけ実行
  timerId = setTimeout(() => {
    processAllBookTitles();
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
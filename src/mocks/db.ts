/**
 * In-memory «база» для MSW. Живёт в localStorage, поэтому созданные книги
 * переживают перезагрузку страницы. Сброс — кнопкой «Сбросить данные» в подвале.
 */
import type { SmsNotification } from '@/types/api'


const STORAGE_KEY = 'catalog.mock.db'
// v2: подписка переехала с e-mail на телефон, добавлен журнал SMS.
const SCHEMA_VERSION = 2

export interface MockAuthor {
  id: number
  full_name: string
}

export interface MockBook {
  id: number
  title: string
  year: number
  description: string
  isbn: string
  cover_url: string
  author_ids: number[]
}

export interface MockSubscription {
  author_id: number
  phone: string
  subscribed_at: string
}

export interface MockDb {
  version: number
  authors: MockAuthor[]
  books: MockBook[]
  subscriptions: MockSubscription[]
  /** Отправленные SMS. Название книги и ФИО автора денормализованы:
      уведомление — исторический факт и не должно меняться задним числом. */
  notifications: SmsNotification[]
}

/* ── Генерация обложек ──────────────────────────────────────────────────── */

function hue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return hash
}

function wrap(text: string, perLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > perLine && line) {
      lines.push(line.trim())
      line = word
    } else {
      line = `${line} ${word}`.trim()
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 5)
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      default:
        return '&quot;'
    }
  })
}

/**
 * Обложка как SVG data-URI: не тянем картинки из сети, демо работает офлайн.
 */
export function generateCover(title: string, author: string): string {
  const base = hue(title + author)
  const lines = wrap(title.toUpperCase(), 13)
  const startY = 250 - (lines.length - 1) * 21

  const titleMarkup = lines
    .map(
      (line, index) =>
        `<text x="40" y="${startY + index * 42}" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${base},58%,55%)"/>
<stop offset="1" stop-color="hsl(${(base + 42) % 360},52%,32%)"/>
</linearGradient></defs>
<rect width="400" height="600" fill="url(#g)"/>
<rect x="24" y="24" width="352" height="552" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
${titleMarkup}
<line x1="40" y1="${startY + lines.length * 42 - 8}" x2="150" y2="${startY + lines.length * 42 - 8}" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
<text x="40" y="${startY + lines.length * 42 + 30}" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="rgba(255,255,255,0.88)">${escapeXml(author)}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n/g, ''))}`
}

/* ── Сид ────────────────────────────────────────────────────────────────── */

/** Дописывает контрольную цифру к 12 цифрам ISBN-13. */
function isbn13(prefix: string): string {
  let sum = 0
  for (let i = 0; i < 12; i += 1) sum += Number(prefix[i]) * (i % 2 === 0 ? 1 : 3)
  return prefix + String((10 - (sum % 10)) % 10)
}

const SEED_AUTHORS: string[] = [
  'Стругацкий Аркадий Натанович',
  'Стругацкий Борис Натанович',
  'Пелевин Виктор Олегович',
  'Водолазкин Евгений Германович',
  'Рубина Дина Ильинична',
  'Иванов Алексей Викторович',
  'Яхина Гузель Шамилевна',
  'Глуховский Дмитрий Алексеевич',
  'Лукьяненко Сергей Васильевич',
  'Дяченко Марина Юрьевна',
  'Дяченко Сергей Сергеевич',
  'Сальников Алексей Борисович',
]

interface SeedBook {
  title: string
  year: number
  authors: number[]
  description: string
}

/** author-индексы 1-based, как id в SEED_AUTHORS после создания. */
const SEED_BOOKS: SeedBook[] = [
  {
    title: 'Пикник на обочине',
    year: 2021,
    authors: [1, 2],
    description:
      'Посещение инопланетян оставило после себя Зоны — территории, где не работают привычные законы физики. Рэдрик Шухарт ходит туда за артефактами и всякий раз возвращается другим человеком.',
  },
  {
    title: 'Трудно быть богом',
    year: 2022,
    authors: [1, 2],
    description:
      'Сотрудник Института экспериментальной истории живёт под видом благородного дона в средневековом королевстве и не имеет права вмешиваться в ход истории.',
  },
  {
    title: 'Улитка на склоне',
    year: 2023,
    authors: [1, 2],
    description: 'Две переплетённые линии: Управление по делам Леса и сам Лес, живущий по непостижимым правилам.',
  },
  {
    title: 'Generation «П»',
    year: 2021,
    authors: [3],
    description: 'История копирайтера Вавилена Татарского, который придумывает рекламу и заодно новую реальность.',
  },
  {
    title: 'Чапаев и Пустота',
    year: 2022,
    authors: [3],
    description: 'Пётр Пустота живёт одновременно в 1919 году и в психиатрической клинике конца века.',
  },
  {
    title: 'Тайные виды на гору Фудзи',
    year: 2023,
    authors: [3],
    description: 'Олигарх покупает себе счастье по подписке, а бывшая одноклассница осваивает практики осознанности.',
  },
  {
    title: 'Путешествие в Элевсин',
    year: 2023,
    authors: [3],
    description: 'Продолжение трансгуманистического цикла: Рим, искусственный интеллект и вечный вопрос о подлинности.',
  },
  {
    title: 'Лавр',
    year: 2020,
    authors: [4],
    description: 'Житие средневекового травника, прошедшего путь от лекаря до юродивого и святого.',
  },
  {
    title: 'Авиатор',
    year: 2022,
    authors: [4],
    description: 'Человек приходит в себя в больничной палате и не помнит ничего, кроме отдельных образов начала XX века.',
  },
  {
    title: 'Чагин',
    year: 2023,
    authors: [4],
    description: 'Архивист с феноменальной памятью вспоминает всё — и потому не может ничего забыть.',
  },
  {
    title: 'Наполеонов обоз',
    year: 2020,
    authors: [5],
    description: 'Семейная сага, растянувшаяся от войны 1812 года до наших дней.',
  },
  {
    title: 'Одинокий пишущий человек',
    year: 2021,
    authors: [5],
    description: 'Книга о ремесле писателя: как рождается сюжет и почему герои перестают слушаться автора.',
  },
  {
    title: 'Тобол. Мало избранных',
    year: 2021,
    authors: [6],
    description: 'Сибирь петровского времени: воеводы, раскольники, пленные шведы и первый сибирский архитектор.',
  },
  {
    title: 'Бронепароходы',
    year: 2023,
    authors: [6],
    description: 'Гражданская война на Каме: речники, нефть и пароходы, ставшие боевыми кораблями.',
  },
  {
    title: 'Вегетация',
    year: 2024,
    authors: [6],
    description: 'Ближайшее будущее Урала, где лес научился защищаться, а люди научились его рубить.',
  },
  {
    title: 'Зулейха открывает глаза',
    year: 2020,
    authors: [7],
    description: 'Раскулаченная татарская крестьянка проходит путь от глухой деревни до поселения на Ангаре.',
  },
  {
    title: 'Эшелон на Самарканд',
    year: 2022,
    authors: [7],
    description: 'Поезд везёт пятьсот голодающих детей через Поволжье 1923 года в Самарканд.',
  },
  {
    title: 'Метро 2033',
    year: 2021,
    authors: [8],
    description: 'После катастрофы человечество спустилось в московское метро и превратило станции в города-государства.',
  },
  {
    title: 'Текст',
    year: 2022,
    authors: [8],
    description: 'Вышедший из колонии филолог получает чужой телефон и вместе с ним чужую жизнь.',
  },
  {
    title: 'Ночной дозор',
    year: 2021,
    authors: [9],
    description: 'Иные делятся на Светлых и Тёмных, а Договор между ними держится на честном слове и балансе сил.',
  },
  {
    title: 'Черновик',
    year: 2023,
    authors: [9],
    description: 'Из жизни Кирилла стирают все следы, а взамен дают работу таможенника между мирами.',
  },
  {
    title: 'Семь дней до Мегиддо',
    year: 2023,
    authors: [9],
    description: 'Человечество вошло в галактическое сообщество и обнаружило, что мест за столом на всех не хватит.',
  },
  {
    title: 'Ведьмин век',
    year: 2022,
    authors: [10, 11],
    description: 'Инквизиция XXI века охотится на женщин, в которых просыпается ведьминская природа.',
  },
  {
    title: 'Vita Nostra',
    year: 2024,
    authors: [10, 11],
    description: 'Саша Самохина поступает в Институт специальных технологий, где студентов переписывают заново.',
  },
  {
    title: 'Петровы в гриппе и вокруг него',
    year: 2020,
    authors: [12],
    description: 'Автослесарь Петров болеет гриппом, и вместе с температурой растворяются границы реального.',
  },
  {
    title: 'Оккульттрегер',
    year: 2024,
    authors: [12],
    description: 'Оккульттрегеры греют города и держат их живыми, пока люди этого не замечают.',
  },
]

export function createSeedDb(): MockDb {
  const authors: MockAuthor[] = SEED_AUTHORS.map((full_name, index) => ({ id: index + 1, full_name }))

  const books: MockBook[] = SEED_BOOKS.map((seed, index) => {
    const id = index + 1
    const firstAuthor = authors.find((author) => author.id === seed.authors[0])
    return {
      id,
      title: seed.title,
      year: seed.year,
      description: seed.description,
      isbn: isbn13(`978500${String(100000 + id * 37).slice(0, 6)}`),
      cover_url: generateCover(seed.title, firstAuthor?.full_name ?? ''),
      author_ids: [...seed.authors],
    }
  })

  return { version: SCHEMA_VERSION, authors, books, subscriptions: [], notifications: [] }
}

/* ── Чтение / запись ────────────────────────────────────────────────────── */

let db: MockDb = load()

function load(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb
      if (parsed.version === SCHEMA_VERSION && Array.isArray(parsed.books)) return parsed
    }
  } catch {
    /* повреждённые данные или недоступное хранилище — пересоздаём сид */
  }
  const seeded = createSeedDb()
  persist(seeded)
  return seeded
}

function persist(next: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Обложки, загруженные пользователем, могут не влезть в квоту —
    // тогда данные живут только до перезагрузки.
  }
}

export function getDb(): MockDb {
  return db
}

export function commit(): void {
  persist(db)
}

export function resetDb(): void {
  db = createSeedDb()
  persist(db)
}

export function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

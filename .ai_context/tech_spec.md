# AURA (Astronaut Unified Risk Assessment) — Technical Specification
**Version:** 2.0 (NASA/CSA Validated)  
**Role:** System Architect & Tech Lead  
**Target Environment:** Autonomous Spacecraft Edge Node & Mission Control Center  

---

## 1. Подбор технологического стека (Tech Stack)

Для обеспечения высокой надежности, автономности в условиях задержки связи ($5–20$ мин) и отзывчивости интерфейса симулятора выбран следующий технологический стек:

*   **Frontend:** **Next.js (React / TypeScript / Tailwind CSS)**
    *   *Аргументация:* Обеспечивает гибридный рендеринг (SSR/SSG/Client Components), что критично для быстрой загрузки бортовых терминалов. TypeScript гарантирует строгую типизацию сложных медицинских данных. Tailwind CSS позволяет создать адаптивный и чистый космический UI. Интерактивная SVG Body Map реализуется нативных React-компонентах с оптимизированным рендерингом состояний ($5$ зон).
*   **Backend:** **NestJS (Node.js / TypeScript)**
    *   *Аргументация:* Модульная архитектура NestJS идеально подходит для масштабируемых систем со сложной бизнес-логикой (управление рисками, телеметрия, симулятор). Строгая инъекция зависимостей (DI), поддержка decorators и встроенная интеграция с валидаторами (`class-validator`) минимизируют ошибки на стыках API.
*   **База данных:** **PostgreSQL 16**
    *   *Аргументация:* Реляционная СУБД с мощной поддержкой JSONB-полей. Позволяет хранить структурированные сущности (экипаж, миссии, протоколы) и гибкие динамические телеметрические потоки (параметры датчиков CANS, газоанализаторов, метаданные симулятора) в одной системе с транзакционной целостностью (ACID).
*   **Кэш и Очереди:** **Redis & BullMQ**
    *   *Аргументация:* Кэширование текущего состояния миссии и параметров среды (`Mission Control`) для мгновенного доступа без нагрузки на БД. BullMQ используется для асинхронной обработки расчетных сценариев симулятора (`Mission Risk Simulator`) и фоновых проверок истечения срока актуальности данных (`Outdated Data Check > 7 days`).
*   **Деплой и Инфраструктура:** **Docker & Docker Compose (Edge-First Architecture)**
    *   *Аргументация:* Поскольку AURA разворачивается на борту корабля с автономным сервером и возможной изоляцией от Земли, полная контейнеризация через Docker Compose обеспечивает быстрое развертывание всей экосистемы (Frontend, Backend, PostgreSQL, Redis) на бортовом железе без зависимости от внешних облачных провайдеров.

---

## 2. Структура проекта (Folder & File Structure)

Проект организован в виде монорепозитория (Monorepo) с использованием `npm workspaces` или Turborepo для совместного использования общих типов и контрактов между клиентом и сервером.

```text
aura-project/
├── apps/
│   ├── web/                     # Frontend (Next.js 15)
│   │   ├── public/              # Статические ассеты, иконки, SVG body map
│   │   ├── src/
│   │   │   ├── app/             # App Router (mission-control, crew, simulator, countermeasures)
│   │   │   ├── components/      # UI компоненты (BodyMap, RiskMatrix, CommDelayBadge, Badges)
│   │   │   ├── hooks/           # Кастомные React хуки (useTelemetry, useSimulation)
│   │   │   └── services/        # API клиенты (Axios / Fetch wrappers)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                     # Backend (NestJS)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── mission/     # Управление статусом миссии и Comm Delay
│       │   │   ├── crew/        # Профили экипажа и Individual Baseline
│       │   │   ├── telemetry/   # Сбор данных [AUTO], [MANUAL], [DEVICE]
│       │   │   ├── simulator/   # Логика моделирования «А что, если?»
│       │   │   └── alerts/      # Генерация и эскалация предупреждений
│       │   ├── prisma/          # Prisma Client синглтон
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared-types/            # Общие TypeScript интерфейсы и типы запросов/ответов
│       ├── src/
│       │   ├── index.ts
│       │   └── api.types.ts
│       └── package.json
│
├── docker-compose.yml           # Оркестрация сервисов для бортового сервера
├── package.json
└── README.md
```

---

## 3. Схема базы данных (Database Schema)

Ниже представлена полная схема базы данных на языке **Prisma Schema** (`schema.prisma`), охватывающая все ключевые сущности системы AURA, включая поддержку тегов источников данных, 5 NASA Hazards и индивидуальных баз сравнения.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum DataSourceType {
  AUTO_TELEMETRY
  MANUAL_REPORT
  DIAGNOSTIC_DEVICE
}

enum HazardType {
  SPACE_RADIATION
  ALTERED_GRAVITY
  ISOLATION_CONFINEMENT
  DISTANCE_FROM_EARTH
  HOSTILE_ENVIRONMENT
}

enum AlertSeverity {
  NOMINAL
  ATTENTION
  CRITICAL
  OUTDATED
}

enum BodyZone {
  HEAD_EYES
  CHEST_CARDIO
  ABDOMEN_METABOLISM
  WHOLE_BODY_IMMUNE
  SKELETON_MUSCLES
}

model Mission {
  id                String              @id @default(uuid())
  name              String              @unique // например, "Mars Transit 2026"
  destination       String              // например, "Mars"
  phase             String              // например, "Cruise Phase"
  missionDay        Int                 // День миссии
  commDelaySeconds  Int                 // Задержка связи в секундах (например, 720 для 12 мин)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  crewMembers       CrewMember[]
  environmentLogs   EnvironmentRecord[]
  alerts            Alert[]
}

model CrewMember {
  id              String             @id @default(uuid())
  missionId       String
  mission         Mission            @relation(fields: [missionId], references: [id], onDelete: Cascade)
  name            String
  role            String             // например, "Commander", "Mission Specialist"
  photoUrl        String?
  age             Int
  status          AlertSeverity      @default(NOMINAL)
  lastSyncedAt    DateTime           @default(now())

  baselines       IndividualBaseline[]
  healthRecords   HealthRecord[]
  alerts          Alert[]

  @@index([missionId])
}

model IndividualBaseline {
  id             String      @id @default(uuid())
  crewMemberId   String
  crewMember     CrewMember  @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)
  zone           BodyZone
  baselineData   Json        // Предоборонные эталонные показатели (pre-flight)
  createdAt      DateTime    @default(now())

  @@index([crewMemberId, zone])
}

model HealthRecord {
  id             String            @id @default(uuid())
  crewMemberId   String
  crewMember     CrewMember        @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)
  sourceType     DataSourceType    // [AUTO], [MANUAL], [DIAGNOSTIC_DEVICE]
  zone           BodyZone?
  metrics        Json              // Динамические показатели (ЧСС, сон, ОКТ, стресс 1-10)
  symptoms       String[]          // Зафиксированные симптомы
  isOutdated     Boolean           @default(false) // Флаг устаревания > 7 дней
  recordedAt     DateTime          @default(now())

  @@index([crewMemberId, recordedAt])
}

model EnvironmentRecord {
  id             String      @id @default(uuid())
  missionId      String
  mission        Mission     @relation(fields: [missionId], references: [id], onDelete: Cascade)
  radiationCans  Float       // Нейтронный спектрометр CANS (мЗв/сут)
  totalRadiation Float       // Общая радиация
  pO2            Float       // Парциальное давление O2 (кПа)
  co2Ppm         Float       // Концентрация CO2 (ppm)
  cabinPressure  Float       // Общее барометрическое давление
  temperature    Float       // Температура (°C)
  humidity       Float       // Влажность (%)
  recordedAt     DateTime    @default(now())

  @@index([missionId, recordedAt])
}

model Alert {
  id             String         @id @default(uuid())
  missionId      String
  mission        Mission        @relation(fields: [missionId], references: [id], onDelete: Cascade)
  crewMemberId   String?
  crewMember     CrewMember?    @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)
  hazardType     HazardType
  severity       AlertSeverity  @default(ATTENTION)
  title          String
  message        String
  isResolved     Boolean        @default(false)
  createdAt      DateTime       @default(now())

  @@index([missionId, severity])
}

model CountermeasureProtocol {
  id          String     @id @default(uuid())
  title       String     // например, "Thigh Cuffs Protocol", "ARED Training"
  hazard      HazardType
  description String
  steps       String[]   // Пошаговые инструкции для экипажа
}
```

---

## 4. API-контракты (API Endpoints & Contracts)

Ниже описаны ключевые REST API эндпоинты бэкенда AURA с указанием методов, путей, типов Request/Response и кодов ошибок.

### 4.1. Получение статуса Mission Control
*   **Method & Path:** `GET /api/v1/missions/current`
*   **Request Body:** `None`
*   **Response Body (200 OK):**
```json
{
  "missionId": "m-uuid-1234",
  "name": "Mars Transit 2026",
  "destination": "Mars",
  "phase": "Cruise Phase",
  "missionDay": 42,
  "commDelaySeconds": 720,
  "commDelayFormatted": "00:12:00",
  "environment": {
    "radiationCans": 1.42,
    "totalRadiation": 3.85,
    "pO2": 21.3,
    "co2Ppm": 540,
    "cabinPressure": 101.3,
    "temperature": 22.4,
    "humidity": 45.0,
    "status": "NOMINAL"
  },
  "hazardsStatus": {
    "spaceRadiation": "NOMINAL",
    "alteredGravity": "ELEVATED",
    "isolationConfinement": "ATTENTION",
    "distanceFromEarth": "NOMINAL",
    "hostileEnvironment": "NOMINAL"
  }
}
```

### 4.2. Получение данных профиля экипажа и Body Map
*   **Method & Path:** `GET /api/v1/crew/:id/health`
*   **Request Body:** `None`
*   **Response Body (200 OK):**
```json
{
  "crewMemberId": "crew-uuid-789",
  "name": "Cmdr. Alex Mercer",
  "role": "Commander",
  "overallStatus": "ATTENTION",
  "zones": [
    {
      "zone": "HEAD_EYES",
      "status": "OUTDATED",
      "lastChecked": "2026-03-01T10:00:00Z",
      "isOutdated": true,
      "message": "Данные устарели (>7 дней). Требуется плановое УЗИ/ОКТ.",
      "sourceType": "DIAGNOSTIC_DEVICE"
    },
    {
      "zone": "CHEST_CARDIO",
      "status": "NOMINAL",
      "lastChecked": "2026-03-08T08:30:00Z",
      "isOutdated": false,
      "metrics": {
        "heartRateResting": 62,
        "bloodPressure": "120/80"
      },
      "sourceType": "AUTO_TELEMETRY"
    }
  ]
}
```

### 4.3. Регистрация ежедневного чека (Daily Health Check)
*   **Method & Path:** `POST /api/v1/crew/checks`
*   **Request Body (JSON):**
```json
{
  "crewMemberId": "crew-uuid-789",
  "sourceType": "MANUAL_REPORT",
  "moodScore": 8,
  "stressScore": 3,
  "fatigueScore": 4,
  "sleepHours": 7.5,
  "symptoms": ["mild_eye_strain"],
  "notes": "Сон стабильный, небольшое утомление к концу смены."
}
```
*   **Response Body (201 Created):**
```json
{
  "success": true,
  "checkId": "chk-uuid-999",
  "xpEarned": 50,
  "currentStreak": 12,
  "message": "Ежедневный отчёт успешно зафиксирован. Начислено 50 XP за регулярность."
}
```

### 4.4. Запуск симуляции «А что, если?» (Mission Risk Simulator)
*   **Method & Path:** `POST /api/v1/simulator/run`
*   **Request Body (JSON):**
```json
{
  "scenarioType": "SOLAR_RADIATION_STORM",
  "parameters": {
    "radiationMultiplier": 4.5,
    "cansSpike": true,
    "gravityLevel": 0.0,
    "countermeasuresActive": true,
    "selectedCountermeasure": "THIGH_CUFFS_AND_B_COMPLEX"
  }
}
```
*   **Response Body (200 OK):**
```json
{
  "simulationId": "sim-uuid-555",
  "predictedImpacts": {
    "dnaRadiationRisk": "ELEVATED",
    "sansRiskShift": "MITIGATED",
    "cognitivePerformance": "STABLE"
  },
  "affectedZones": ["HEAD_EYES", "WHOLE_BODY_IMMUNE"],
  "recommendedProtocolId": "proto-uuid-01",
  "recommendationText": "Применить вакуумные бедренные манжеты (Thigh Cuffs) и витаминный комплекс B-Complex."
}
```

### 4.5. Стандартные коды ошибок API
Все эндпоинты возвращают стандартный JSON-формат ошибки в случае сбоя:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Invalid parameter format for simulation payload"],
  "timestamp": "2026-03-08T22:00:00.000Z"
}
```
*   **400 Bad Request:** Ошибка валидации тела запроса (проверяется с помощью Zod / class-validator).
*   **401 Unauthorized:** Отсутствует или недействителен бортовой JWT-токен авторизации астронавта.
*   **403 Forbidden:** У пользователя недостаточно прав для выполнения операции (например, попытка изменения конфигурации миссии без роли командира).
*   **404 Not Found:** Запрашиваемый ресурс (член экипажа, миссия, сценарий симуляции) не найден в базе данных.
*   **500 Internal Server Error:** Непредвиденная ошибка на бортовом сервере (сбой соединения с базой данных или ошибкой в фоновом воркере BullMQ).

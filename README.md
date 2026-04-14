This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Fixed Input Workflow (Manual Fast Path)

Use one fixed input file per workflow and one fixed command.

### 1) Choice post (life)

- Input file: `scripts/choice-input.latest.json`
- Run:

```bash
npm run generate:choice:latest
```

### 2) Blog post (festival / incheon / subsidy)

- Input file: `scripts/blog-input.latest.json`
- Run:

```bash
npm run generate:blog:latest
```

### Quick pre-run checklist

- `choice-input.latest.json`: `englishName`, `summary`, `keywordHint` 확인
- `blog-input.latest.json`: `category`, `keyword` 확인
- 중복 방지: 같은 slug/행사명 재사용 여부 확인
- 실행 후 검증: `npm run build`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

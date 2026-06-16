import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Эндпоинт временно недоступен. Используйте /api/parse и /api/translate." },
    { status: 501 },
  );
}

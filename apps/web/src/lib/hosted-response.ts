import {NextResponse} from "next/server";
export const noStoreHeaders={"Cache-Control":"no-store, no-cache, max-age=0, must-revalidate",
  "X-Robots-Tag":"noindex, nofollow, noarchive"} as const;
export function apiResult(value:unknown,status=200){
  return NextResponse.json(value,{status,headers:noStoreHeaders});
}

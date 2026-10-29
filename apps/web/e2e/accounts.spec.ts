import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFile,rm} from "node:fs/promises";
import {join} from "node:path";

/**
 * Runs only against a server with hosted publishing switched on and sign-in
 * links written to MOSSLINE_TEST_MAIL_DIR (CI starts Postgres for this).
 */
const mailDir=process.env.MOSSLINE_TEST_MAIL_DIR;
const axe=async(page:Page)=>expect((await new AxeBuilder({page}).include(".ml-atlas")
  .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
async function signInLink(email:string){
  const file=join(mailDir!,email+".txt");
  for(let i=0;i<40;i++){
    try{return (await readFile(file,"utf8")).trim();}catch{await new Promise(r=>setTimeout(r,250));}
  }
  throw Error("No sign-in link was written for "+email);
}

test("publishing needs an account: sign in by email, publish, update, unpublish, delete the account",async({page,request})=>{
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!mailDir,"Hosted publishing is not configured for this server");
  const email="sam."+Date.now()+"@example.net";
  await rm(join(mailDir!,email+".txt"),{force:true});

  await page.goto("/");
  await page.getByRole("button",{name:/Map your own data/}).click();
  await page.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await page.getByRole("button",{name:"Create the map"}).click();
  await page.locator(".ml-toast button").click();

  // Signed out, the card explains and offers sign-in; nothing else needs an account.
  await page.locator(".ml-share summary").click();
  await page.getByRole("button",{name:"Publish online…"}).click();
  const card=page.getByRole("complementary",{name:"Publish online"});
  await expect(card).toContainText("You'll need to sign in");
  await card.getByRole("link",{name:"Sign in to publish"}).click();

  await expect(page.getByRole("heading",{name:"Sign in to publish"})).toBeVisible();
  // Only the ways in this deployment has credentials for are offered.
  await expect(page.getByRole("button",{name:"Continue with Microsoft"})).toHaveCount(status.signIn.microsoft?1:0);
  await expect(page.getByRole("button",{name:"Continue with Google"})).toHaveCount(status.signIn.google?1:0);
  await axe(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button",{name:"Email me a sign-in link"}).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await signInLink(email));

  // Back in the same map, signed in.
  await expect(page.locator(".ml-header .ml-share")).toBeVisible();
  await page.locator(".ml-share summary").click();
  await page.getByRole("button",{name:"Publish online…"}).click();
  await expect(card).toContainText("Signed in as");
  await card.getByLabel("Title").fill("Kitchen loops, first look");
  await expect(card.getByRole("button",{name:"Publish",exact:true})).toBeDisabled();
  await card.getByText("Check everything that will be public").click();
  await card.getByLabel(/I've checked this/).check();
  await axe(page);
  await card.getByRole("button",{name:"Publish",exact:true}).click();
  await expect(card).toContainText("Published.");
  const link=await card.getByLabel("Link to the published map").inputValue();
  const slug=link.split("/p/")[1];

  const published=await page.context().newPage();
  await published.goto("/p/"+slug);
  await expect(published.getByText("Kitchen loops, first look").first()).toBeVisible();
  // The published copy opens in the atlas, read-only, with the links' signs kept.
  await expect(published.getByRole("button",{name:"Copy link"})).toBeVisible();
  await expect(published.getByRole("button",{name:"Edit",exact:true})).toHaveCount(0);
  await expect(published.getByRole("complementary",{name:"Feedback loops"})).toContainText("R1");
  await axe(published);

  // Updating keeps the link.
  await card.getByLabel("Publish as").selectOption(slug);
  await card.getByLabel("Title").fill("Kitchen loops, second look");
  await card.getByLabel(/I've checked this/).check();
  await card.getByRole("button",{name:"Update the published map"}).click();
  await expect(card).toContainText("The same link shows the new version");
  await published.reload();
  await expect(published.getByText("Kitchen loops, second look").first()).toBeVisible();

  // Another site can't publish on this account's behalf.
  const forged=await page.request.post("/api/publications",{headers:{origin:"https://elsewhere.example"},data:{snapshot:{}}});
  expect(forged.status()).toBe(403);

  // The account page lists it; unpublishing deletes it.
  await page.goto("/account");
  await expect(page.getByRole("heading",{name:"Your account"})).toBeVisible();
  await expect(page.locator(".ml-account-maps")).toContainText("Kitchen loops, second look");
  await axe(page);
  await page.getByRole("button",{name:"Unpublish…"}).click();
  await page.getByRole("button",{name:"Unpublish",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"unpublished"})).toBeVisible();
  await expect(page.locator(".ml-account-empty")).toHaveText("Nothing published yet.");
  expect((await published.goto("/p/"+slug))?.status()).toBe(404);

  // Deleting the account signs out and removes it.
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button",{name:"Delete account"}).click();
  await expect(page.getByRole("status").filter({hasText:"have been deleted"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Sign in"})).toBeVisible();
  expect((await page.request.get("/api/publications")).status()).toBe(401);
});

test("addresses that aren't set up to publish get no account",async({page,request})=>{
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!mailDir,"Hosted publishing is not configured for this server");
  const email="someone."+Date.now()+"@not-listed.example";
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button",{name:"Email me a sign-in link"}).click();
  // The page says the same thing either way, so it can't be used to find out who has an account.
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.waitForTimeout(500);
  await expect(readFile(join(mailDir!,email+".txt"),"utf8")).rejects.toThrow();
});

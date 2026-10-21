import type {Metadata} from "next";
export const metadata:Metadata={title:"Published network — Mossline",
  robots:{index:false,follow:false,noarchive:true}};
export default function PublicationLayout({children}:{children:React.ReactNode}){
  return children;
}

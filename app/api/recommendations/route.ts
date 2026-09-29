import { NextResponse } from 'next/server';
import { PoiService } from '@/lib/poi-service';
import { PlaceSearchError } from '@/lib/place-service';
export const runtime='nodejs';export const dynamic='force-dynamic';
declare global {var tripPilotPoiService:PoiService|undefined;}
export async function GET(request:Request){
  const endpoint=process.env.POI_SERVICE_URL;
  if(process.env.NODE_ENV==='production'&&!endpoint)return NextResponse.json({error:'Nearby discovery needs a hosted place connection.'},{status:503});
  try{
    const params=new URL(request.url).searchParams,lat=params.get('lat'),lon=params.get('lon');
    if(!lat?.trim()||!lon?.trim())throw new PlaceSearchError('Choose a destination.',400);
    globalThis.tripPilotPoiService??=new PoiService(endpoint);
    const places=await globalThis.tripPilotPoiService.nearby(Number(lat),Number(lon));
    return NextResponse.json({places,source:'OpenStreetMap',attributionUrl:'https://www.openstreetmap.org/copyright'},{headers:{'Cache-Control':'no-store'}});
  }catch(error){const status=error instanceof PlaceSearchError?error.status:503;return NextResponse.json({error:error instanceof PlaceSearchError?error.message:'Nearby discovery is unavailable.'},{status,headers:status===429?{'Retry-After':'60'}:undefined});}
}

/** Basemap names drawn by the Map lens: seas and oceans worldwide, and the
 *  main upland and island names in Britain and Ireland. These are cartographic
 *  orientation only. They are never used to place records, which come from
 *  source coordinates alone. Label points are approximate centres.
 *  [name, longitude, latitude, minimum zoom, maximum zoom] */
export type BaseName = [string, number, number, number, number];

export const OCEANS: BaseName[] = [
  ["North Atlantic Ocean", -38, 38, 0, 5], ["South Atlantic Ocean", -15, -25, 0, 5],
  ["North Pacific Ocean", -150, 25, 0, 5], ["South Pacific Ocean", -120, -25, 0, 5],
  ["Indian Ocean", 78, -18, 0, 5], ["Arctic Ocean", 0, 84, 0, 5], ["Southern Ocean", 20, -60, 0, 5]
];

export const SEAS: BaseName[] = [
  ["North Sea", 2.6, 56.4, 3.2, 9], ["Irish Sea", -5.2, 53.8, 4, 9.5], ["English Channel", -1.6, 50.15, 4.5, 10],
  ["Celtic Sea", -7.2, 50.9, 4, 9], ["Sea of the Hebrides", -7.1, 57.0, 6, 10], ["Norwegian Sea", 4, 67, 3, 8],
  ["Baltic Sea", 19, 57, 3, 8], ["Gulf of Bothnia", 20.5, 63, 4, 8], ["Bay of Biscay", -4.5, 45.4, 3.5, 8],
  ["Mediterranean Sea", 18, 34.6, 2.6, 7], ["Tyrrhenian Sea", 12, 40, 4.5, 9], ["Adriatic Sea", 15.6, 42.9, 4.5, 9],
  ["Ionian Sea", 19, 37.6, 4.5, 9], ["Aegean Sea", 25, 38.6, 4.5, 9], ["Black Sea", 34, 43.2, 3, 8],
  ["Caspian Sea", 50.5, 42, 3, 8], ["Red Sea", 38.5, 20, 3, 8], ["Persian Gulf", 51.5, 27, 4, 9],
  ["Gulf of Aden", 48, 12.6, 4, 9], ["Arabian Sea", 64, 15, 2.6, 7], ["Bay of Bengal", 88, 15, 2.6, 7],
  ["Andaman Sea", 96, 11, 4, 9], ["South China Sea", 114, 13, 2.6, 7], ["Java Sea", 111, -5, 4, 9],
  ["East China Sea", 125.5, 29, 3.5, 8], ["Yellow Sea", 123, 36, 4, 9], ["Sea of Japan", 135, 40, 3.5, 8],
  ["Philippine Sea", 133, 20, 3, 7], ["Sea of Okhotsk", 148, 54, 3, 8], ["Bering Sea", -178, 58, 3, 8],
  ["Coral Sea", 154, -17, 3, 8], ["Tasman Sea", 160, -38, 3, 8], ["Arafura Sea", 135, -9.5, 4, 9],
  ["Timor Sea", 127, -11.5, 4, 9], ["Great Australian Bight", 130, -35, 4, 9], ["Gulf of Mexico", -90, 25, 3, 8],
  ["Caribbean Sea", -75, 15, 3, 8], ["Gulf of California", -112, 28, 4.5, 9], ["Gulf of Alaska", -145, 57, 3, 8],
  ["Hudson Bay", -85, 60, 3, 8], ["Labrador Sea", -55, 58, 3, 8], ["Greenland Sea", -5, 76, 3, 8],
  ["Barents Sea", 40, 74, 3, 8], ["Kara Sea", 70, 76, 3, 8], ["Laptev Sea", 125, 76, 3, 8],
  ["Beaufort Sea", -140, 72, 3, 8], ["Gulf of Guinea", 3, 2, 3, 8], ["Mozambique Channel", 41, -18, 4, 9],
  ["Scotia Sea", -45, -57, 3, 8], ["Weddell Sea", -45, -70, 3, 8], ["Ross Sea", -175, -75, 3, 8]
];

export const REGIONS: BaseName[] = [
  ["North Pennines", -2.3, 54.75, 6, 11], ["Lake District", -3.1, 54.5, 6, 11], ["Cheviot Hills", -2.2, 55.42, 6, 11],
  ["North York Moors", -0.9, 54.37, 6, 11], ["Yorkshire Dales", -2.1, 54.25, 6, 11], ["Peak District", -1.8, 53.3, 6, 11],
  ["Isle of Man", -4.55, 54.23, 5.5, 11], ["Snowdonia", -3.9, 53.0, 6, 11], ["Brecon Beacons", -3.45, 51.88, 6, 11],
  ["Dartmoor", -3.92, 50.57, 6.5, 11], ["Exmoor", -3.65, 51.13, 6.5, 11], ["Cotswolds", -1.9, 51.8, 6.5, 11],
  ["Chiltern Hills", -0.8, 51.7, 7, 11], ["South Downs", -0.6, 50.9, 7, 11], ["The Fens", 0.1, 52.5, 6.5, 11],
  ["Norfolk Broads", 1.55, 52.7, 7, 11], ["Southern Uplands", -3.6, 55.4, 6, 11], ["Cairngorms", -3.65, 57.08, 6, 11],
  ["Scottish Highlands", -4.8, 57.4, 5.5, 9], ["Isle of Skye", -6.2, 57.3, 6, 11], ["Outer Hebrides", -7.0, 57.8, 5.5, 11],
  ["Orkney", -3.0, 59.0, 5.5, 11], ["Shetland", -1.3, 60.3, 5.5, 11], ["Isle of Wight", -1.3, 50.68, 6.5, 11],
  ["Anglesey", -4.35, 53.27, 6.5, 11], ["Wicklow Mountains", -6.35, 53.05, 6.5, 11], ["Mourne Mountains", -6.0, 54.17, 7, 11],
  ["Connemara", -9.8, 53.45, 6.5, 11], ["The Burren", -9.1, 53.03, 7, 11], ["Sperrin Mountains", -7.0, 54.8, 7, 11]
];

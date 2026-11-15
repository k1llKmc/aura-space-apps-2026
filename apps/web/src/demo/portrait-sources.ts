import { demoCrewIds } from './config';
export const portraitSources = [
  { name: 'Christina Koch', nasaId: 'jsc2018e095073_alt' },
  { name: 'Victor Glover', nasaId: 'KSC-20200814-PH-SPX01_0005' },
  { name: 'Jessica Watkins', nasaId: 'NHQ202009150003' },
  { name: 'Reid Wiseman', nasaId: 'jsc2013e090068' },
  { name: 'Jessica Meir', nasaId: 'NHQ202009150005' },
  { name: 'Kjell Lindgren', nasaId: 'NHQ202009160011' },
];
export function portraitSource(id: string) {
  const source = portraitSources[demoCrewIds.indexOf(id)];
  return source
    ? { ...source, url: `https://images.nasa.gov/details/${source.nasaId}` }
    : undefined;
}

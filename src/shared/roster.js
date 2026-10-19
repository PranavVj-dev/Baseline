// Edit this file to change the roster. Names come from the team's paper stat sheets.
// Jersey numbers are optional: add `no: 7` to a player to show it. Keep this repo
// private while real names are in here.
export const TEAM_NAME = 'Don Bosco';

const NAMES = ['Neha', 'Sahanaa', 'Asmi', 'Medha', 'Pratinka', 'Hasini', 'Sonakshi', 'Tanishka', 'Samvruthi', 'Aushima'];

export const ROSTER = NAMES.map((name, i) => ({ id: `p${i + 1}`, name }));

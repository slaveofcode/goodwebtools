/**
 * Pure builder for the emergency medical card's text payload (used for both the
 * printed card and the QR code). Only non-empty fields are included. No I/O.
 */

export interface MedContact {
  name: string;
  relation: string;
  phone: string;
}

export interface MedCardData {
  name: string;
  dob: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  medications: string;
  organDonor: boolean;
  notes: string;
  contacts: MedContact[];
}

export function buildCardText(d: MedCardData): string {
  const lines: string[] = ['EMERGENCY MEDICAL CARD'];
  const add = (label: string, value: string) => {
    if (value && value.trim()) lines.push(`${label}: ${value.trim()}`);
  };
  add('Name', d.name);
  add('DOB', d.dob);
  add('Blood', d.bloodType);
  add('Allergies', d.allergies);
  add('Conditions', d.conditions);
  add('Medications', d.medications);

  const contacts = d.contacts.filter(c => c.phone && c.phone.trim());
  if (contacts.length) {
    lines.push('Emergency contacts:');
    for (const c of contacts) {
      const who = c.relation && c.relation.trim() ? `${c.name} (${c.relation.trim()})` : c.name;
      lines.push(`- ${who}: ${c.phone.trim()}`);
    }
  }

  lines.push(`Organ donor: ${d.organDonor ? 'Yes' : 'No'}`);
  add('Notes', d.notes);
  return lines.join('\n');
}

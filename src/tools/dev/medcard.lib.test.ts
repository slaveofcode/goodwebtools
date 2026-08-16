import { describe, it, expect } from 'vitest';
import { buildCardText, type MedCardData } from './medcard.lib';

const base: MedCardData = {
  name: 'Aditya',
  dob: '1990-08-17',
  bloodType: 'O+',
  allergies: 'Penicillin',
  conditions: 'Asthma',
  medications: 'Salbutamol',
  organDonor: true,
  notes: '',
  contacts: [{ name: 'Sinta', relation: 'Spouse', phone: '0812' }],
};

describe('buildCardText', () => {
  it('includes filled fields with labels', () => {
    const text = buildCardText(base);
    expect(text).toContain('EMERGENCY MEDICAL CARD');
    expect(text).toContain('Name: Aditya');
    expect(text).toContain('Blood: O+');
    expect(text).toContain('Allergies: Penicillin');
    expect(text).toContain('Sinta (Spouse): 0812');
    expect(text).toContain('Organ donor: Yes');
  });

  it('omits empty fields', () => {
    const text = buildCardText({ ...base, allergies: '', conditions: '', notes: '' });
    expect(text).not.toContain('Allergies:');
    expect(text).not.toContain('Conditions:');
    expect(text).not.toContain('Notes:');
  });

  it('omits contacts without a phone', () => {
    const text = buildCardText({ ...base, contacts: [{ name: 'X', relation: '', phone: '' }] });
    expect(text).not.toContain('X (');
  });

  it('shows organ donor No when false', () => {
    expect(buildCardText({ ...base, organDonor: false })).toContain('Organ donor: No');
  });
});

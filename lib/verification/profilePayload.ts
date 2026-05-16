/** Payload de perfil compartido entre /verificacion y API de envío. */
export type VerificationProfileInput = {
  first_name: string;
  apellido_paterno: string;
  apellido_materno: string;
  nickname: string;
  rfc: string;
  curp: string;
  address_street: string;
  ext_number: string;
  int_number: string;
  neighborhood: string;
  zip_code: string;
  state: string;
  city: string;
  references: string;
  cross_streets: string;
  phone: string;
  ine_front_url: string;
  ine_back_url: string;
  selfie_ine_url: string;
};

export function buildVerificationProfilePayload(input: VerificationProfileInput): Record<string, unknown> {
  const first = input.first_name.trim();
  const ap = input.apellido_paterno.trim();
  const am = input.apellido_materno.trim();
  const fullName = `${first} ${ap} ${am}`.trim();
  const lastName = `${ap} ${am}`.trim();

  return {
    first_name: first,
    apellido_paterno: ap,
    apellido_materno: am,
    last_name: lastName || null,
    nickname: input.nickname.trim(),
    rfc: input.rfc.trim().toUpperCase(),
    curp: input.curp.trim().toUpperCase(),
    full_name: fullName,
    address_street: input.address_street.trim(),
    ext_number: input.ext_number.trim(),
    int_number: input.int_number.trim(),
    neighborhood: input.neighborhood.trim(),
    zip_code: input.zip_code.trim(),
    state: input.state.trim(),
    city: input.city.trim(),
    references: input.references.trim(),
    cross_streets: input.cross_streets.trim(),
    phone: input.phone.trim(),
    ine_front_url: input.ine_front_url.trim(),
    ine_back_url: input.ine_back_url.trim(),
    selfie_ine_url: input.selfie_ine_url.trim(),
    verification_status: 'pending',
    verification_rejection_reason: null,
    verification_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

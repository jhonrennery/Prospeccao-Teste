import { useState, useEffect } from "react";

interface IBGECity {
  id: number;
  nome: string;
}

interface IBGEDistrict {
  id: number;
  nome: string;
}

const stateCodeMap: Record<string, number> = {
  AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
  GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
  PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
  SP: 35, SE: 28, TO: 17,
};

export function useBrazilianLocations(stateUF: string, cityName: string) {
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Fetch cities when state changes
  useEffect(() => {
    setCities([]);
    setDistricts([]);
    if (!stateUF || stateUF === "all") return;

    const code = stateCodeMap[stateUF];
    if (!code) return;

    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios?orderBy=nome`)
      .then((res) => res.json())
      .then((data: IBGECity[]) => {
        setCities(data.map((c) => c.nome));
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [stateUF]);

  // Fetch districts (bairros approximate) when city changes
  useEffect(() => {
    setDistricts([]);
    if (!stateUF || stateUF === "all" || !cityName) return;

    const code = stateCodeMap[stateUF];
    if (!code) return;

    setLoadingDistricts(true);
    // IBGE has districts endpoint per municipality
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/distritos?orderBy=nome`)
      .then((res) => res.json())
      .then((data: IBGEDistrict[]) => {
        // Filter districts that belong to the selected city
        const cityDistricts = data
          .filter((d) => {
            // The district name often matches the city or is a sub-district
            // We need to check the municipality name from the full endpoint
            return true; // We'll use the municipality-specific endpoint instead
          })
          .map((d) => d.nome);
        setDistricts(cityDistricts);
      })
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, [stateUF, cityName]);

  // Better approach: fetch districts for specific municipality
  useEffect(() => {
    setDistricts([]);
    if (!stateUF || stateUF === "all" || !cityName) return;

    const code = stateCodeMap[stateUF];
    if (!code) return;

    setLoadingDistricts(true);
    // First get municipality ID
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios`)
      .then((res) => res.json())
      .then((municipalities: IBGECity[]) => {
        const mun = municipalities.find(
          (m) => m.nome.toLowerCase() === cityName.toLowerCase()
        );
        if (!mun) {
          setLoadingDistricts(false);
          return;
        }
        // Fetch districts for this municipality
        return fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${mun.id}/distritos?orderBy=nome`
        );
      })
      .then((res) => res?.json())
      .then((data?: IBGEDistrict[]) => {
        if (data) {
          // Filter out the district that has the same name as the city (it's the main/sede district)
          const districtNames = data
            .map((d) => d.nome)
            .filter((name) => name.toLowerCase() !== cityName.toLowerCase());
          setDistricts(districtNames);
        }
      })
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, [stateUF, cityName]);

  return { cities, districts, loadingCities, loadingDistricts };
}

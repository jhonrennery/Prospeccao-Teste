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
  const [municipalitiesMap, setMunicipalitiesMap] = useState<IBGECity[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Fetch cities when state changes
  useEffect(() => {
    setCities([]);
    setMunicipalitiesMap([]);
    setDistricts([]);
    if (!stateUF || stateUF === "all") return;

    const code = stateCodeMap[stateUF];
    if (!code) return;

    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios?orderBy=nome`)
      .then((res) => res.json())
      .then((data: IBGECity[]) => {
        setMunicipalitiesMap(data);
        setCities(data.map((c) => c.nome));
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [stateUF]);

  // Fetch districts when city changes
  useEffect(() => {
    setDistricts([]);
    if (!cityName || municipalitiesMap.length === 0) return;

    const mun = municipalitiesMap.find(
      (m) => m.nome.toLowerCase() === cityName.toLowerCase()
    );
    if (!mun) return;

    setLoadingDistricts(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${mun.id}/distritos?orderBy=nome`)
      .then((res) => res.json())
      .then((data: IBGEDistrict[]) => {
        const names = data
          .map((d) => d.nome)
          .filter((name) => name.toLowerCase() !== cityName.toLowerCase());
        setDistricts(names);
      })
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, [cityName, municipalitiesMap]);

  return { cities, districts, loadingCities, loadingDistricts };
}

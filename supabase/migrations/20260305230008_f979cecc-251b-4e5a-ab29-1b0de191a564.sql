
-- Create search_jobs table
CREATE TABLE public.search_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  segment TEXT NOT NULL,
  location TEXT NOT NULL,
  radius_km INTEGER DEFAULT 10,
  minimum_rating NUMERIC(2,1) DEFAULT 0,
  has_website BOOLEAN DEFAULT false,
  max_results INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending',
  total_found INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search jobs" ON public.search_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create search jobs" ON public.search_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own search jobs" ON public.search_jobs FOR UPDATE USING (auth.uid() = user_id);

-- Create places table
CREATE TABLE public.places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_job_id UUID REFERENCES public.search_jobs(id) ON DELETE CASCADE,
  place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  rating NUMERIC(2,1),
  total_reviews INTEGER DEFAULT 0,
  category TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  google_maps_url TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, place_id)
);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own places" ON public.places FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create places" ON public.places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own places" ON public.places FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own places" ON public.places FOR DELETE USING (auth.uid() = user_id);

-- Create place_enrichment table
CREATE TABLE public.place_enrichment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
  email TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0,
  source TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.place_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrichment" ON public.place_enrichment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create enrichment" ON public.place_enrichment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own enrichment" ON public.place_enrichment FOR UPDATE USING (auth.uid() = user_id);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_search_jobs_updated_at BEFORE UPDATE ON public.search_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_place_enrichment_updated_at BEFORE UPDATE ON public.place_enrichment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

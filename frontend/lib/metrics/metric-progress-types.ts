export type MetricProgressItem = {
  label: string;
  val: string;
  color: string;
  progress: number;
};

export type MetricProgressGroup = {
  title: string;
  items: MetricProgressItem[];
};

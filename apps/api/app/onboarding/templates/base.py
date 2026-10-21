from dataclasses import dataclass, field


@dataclass(frozen=True)
class StageSpec:
    name: str
    probability: int
    color: str
    kind: str = "open"  # open | won | lost


@dataclass(frozen=True)
class OptionSpec:
    value: str
    label: str
    color: str


@dataclass(frozen=True)
class FieldSpec:
    key: str
    label: str
    type: str
    options: tuple[OptionSpec, ...] = ()
    samples: tuple[str, ...] = ()
    number_range: tuple[float, float] | None = None
    fill_rate: float = 0.85


@dataclass(frozen=True)
class Flavor:
    company_names: tuple[str, ...]
    industries: tuple[str, ...]
    sizes: tuple[str, ...]
    titles: tuple[str, ...]
    deal_patterns: tuple[str, ...]
    value_range: tuple[int, int]
    tlds: tuple[str, ...] = (".com",)
    currency: str = "USD"
    email_subjects: tuple[str, ...] = ()
    reply_subjects: tuple[str, ...] = ()
    meeting_titles: tuple[str, ...] = ()
    call_summaries: tuple[str, ...] = ()
    note_bodies: tuple[str, ...] = ()
    task_titles: tuple[str, ...] = ()
    # Companies have web domains (False for households etc.).
    domains: bool = True
    # When set, contact emails use these personal domains instead of the company domain.
    personal_email_domains: tuple[str, ...] = ()
    # Values for the {unit} placeholder in deal patterns.
    unit_prefixes: tuple[str, ...] = ("A", "B", "C")


@dataclass(frozen=True)
class IndustryTemplate:
    key: str
    name: str
    tagline: str
    keywords: tuple[str, ...]
    terminology: dict[str, str]
    pipeline_name: str
    stages: tuple[StageSpec, ...]
    fields: dict[str, tuple[FieldSpec, ...]]
    flavor: Flavor
    example_prompt: str = ""
    teammates: tuple[str, ...] = field(default=("Maya Chen", "Jonas Weber", "Priya Raman"))


def opts(*items: tuple[str, str, str]) -> tuple[OptionSpec, ...]:
    return tuple(OptionSpec(v, label, c) for v, label, c in items)

from httpx import AsyncClient

from tests.helpers import API, first_id


async def test_list_fields_by_object(client: AsyncClient) -> None:
    fields = (await client.get(f"{API}/fields", params={"object_type": "deal"})).json()
    assert [f["key"] for f in fields][:2] == ["seats", "contract_term"]
    assert all(f["object_type"] == "deal" for f in fields)


async def test_new_field_is_usable_immediately_and_cleaned_on_delete(client: AsyncClient) -> None:
    res = await client.post(
        f"{API}/fields",
        json={
            "object_type": "company",
            "label": "Region",
            "type": "select",
            "options": [{"label": "EMEA"}, {"label": "North America"}],
        },
    )
    assert res.status_code == 201, res.text
    field = res.json()
    assert field["key"] == "region" and field["options"][1]["value"] == "north_america"
    company_id = await first_id(client, "companies")
    patched = await client.patch(
        f"{API}/companies/{company_id}", json={"custom": {"region": "emea"}}
    )
    assert patched.json()["custom"]["region"] == "emea"

    renamed = await client.patch(f"{API}/fields/{field['id']}", json={"label": "Sales region"})
    assert renamed.json()["label"] == "Sales region"

    ids = [
        f["id"]
        for f in (await client.get(f"{API}/fields", params={"object_type": "company"})).json()
    ]
    reordered = await client.post(
        f"{API}/fields/reorder", json={"object_type": "company", "field_ids": [ids[-1], *ids[:-1]]}
    )
    assert reordered.json()[0]["id"] == field["id"]

    assert (await client.delete(f"{API}/fields/{field['id']}")).status_code == 200
    company = (await client.get(f"{API}/companies/{company_id}")).json()
    assert "region" not in company["custom"]


async def test_field_errors(client: AsyncClient) -> None:
    dup = await client.post(
        f"{API}/fields", json={"object_type": "deal", "label": "Seats", "type": "number"}
    )
    assert dup.status_code == 409
    bad_type = await client.post(
        f"{API}/fields", json={"object_type": "deal", "label": "X", "type": "color"}
    )
    assert bad_type.status_code == 422

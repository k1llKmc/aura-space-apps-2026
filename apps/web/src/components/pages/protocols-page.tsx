'use client';
import { useState } from 'react';
import type { ListResponse, ProtocolResponse } from '@aura/shared-types';
import { HazardType } from '@aura/shared-types';
import { useApiResource } from '@/hooks/use-api-resource';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
} from '@/components/ui/ui';
export function ProtocolsPage() {
  const [hazard, setHazard] = useState(''),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<ProtocolResponse>();
  const resource = useApiResource<ListResponse<ProtocolResponse>>(
    `/protocols?limit=12&offset=${offset}${hazard ? `&hazard=${hazard}` : ''}`,
  );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Resources / Reference library"
        title="Countermeasure Protocols"
        description="Browse mission reference protocols and their step-by-step guidance."
        actions={<Button onClick={resource.refresh}>Refresh library</Button>}
      />
      <div className="filter-bar">
        <label>
          Hazard category
          <select
            aria-label="Hazard category"
            value={hazard}
            onChange={(event) => {
              setHazard(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">All categories</option>
            {Object.values(HazardType).map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {resource.error && (
        <ErrorState message={resource.error} retry={resource.refresh} />
      )}
      {!resource.data && resource.loading && (
        <LoadingState label="Loading protocol library…" />
      )}
      {resource.data && (
        <>
          {resource.data.items.length ? (
            <div className="protocol-grid">
              {resource.data.items.map((protocol) => (
                <article
                  className="panel section-panel flex flex-col gap-4"
                  key={protocol.id}
                >
                  <Badge value={protocol.hazard} />
                  <h2 className="text-xl font-semibold">{protocol.title}</h2>
                  <p className="muted flex-1">{protocol.description}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="muted text-xs">
                      {protocol.steps.length} steps
                    </span>
                    <Button onClick={() => setSelected(protocol)}>
                      Read protocol →
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No protocols in this category"
              description="Try another hazard category or refresh the library."
            />
          )}
          <Pagination
            offset={offset}
            total={resource.data.total}
            limit={12}
            onChange={setOffset}
          />
        </>
      )}
      <Modal
        open={!!selected}
        title={selected?.title || 'Protocol'}
        onClose={() => setSelected(undefined)}
      >
        {selected && (
          <div className="space-y-5">
            <Badge value={selected.hazard} />
            <p className="muted">{selected.description}</p>
            <ol className="protocol-steps">
              {selected.steps.map((step, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
            <p className="muted text-xs">
              Reference guidance. Follow the medical team’s instructions and
              mission-approved procedures.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

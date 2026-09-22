// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@mochi/web'

interface PathBreadcrumbProps {
  fingerprint: string
  gitRef: string
  name: string
  pathParts: string[]
}

// The repository name links to the tree root, each folder to its own tree,
// and the last segment is the folder or file being shown.
export function PathBreadcrumb({
  fingerprint,
  gitRef,
  name,
  pathParts,
}: PathBreadcrumbProps) {
  const { t } = useLingui()

  return (
    <Breadcrumb aria-label={t`Path`}>
      <BreadcrumbList className='gap-1 sm:gap-1'>
        <BreadcrumbItem>
          <BreadcrumbLink
            asChild
            className='text-primary hover:text-primary hover:underline'
          >
            <Link
              to='/$repoId/tree/$ref/$'
              params={{ repoId: fingerprint, ref: gitRef, _splat: '' }}
            >
              {name}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathParts.map((part, index) => {
          const pathTo = pathParts.slice(0, index + 1).join('/')
          return (
            <Fragment key={pathTo}>
              <BreadcrumbSeparator className='[&>svg]:size-4' />
              <BreadcrumbItem>
                {index === pathParts.length - 1 ? (
                  <BreadcrumbPage className='font-medium'>
                    {part}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild
                    className='text-primary hover:text-primary hover:underline'
                  >
                    <Link
                      to='/$repoId/tree/$ref/$'
                      params={{
                        repoId: fingerprint,
                        ref: gitRef,
                        _splat: pathTo,
                      }}
                    >
                      {part}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

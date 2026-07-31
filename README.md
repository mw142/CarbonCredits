## Core System Flow
### 1. **Backend / Database** Import public CER project information
The system regularly imports publicly available project information from the Clean Energy Regulator (CER). This may be collected from public datasets, downloadable register files, or other approved public sources.
The imported information may include:
- CER project ID
- Project name
- Project proponent
- Project method
- Project type
- General project location
- Registration dates
- Crediting period
- Project status
- Total ACCUs issued
- Total ACCUs relinquished
- Other publicly available project information
Each CER project is stored as an official project record in the system.
Projects can appear in the system even when no registered user has claimed or created a listing for them.
The database must record:
- The source of the CER information
- When the data was imported
- When the source data was last updated
- Whether the import succeeded
- Which projects were added or updated
CER imports must only update official CER fields. They must not overwrite information supplied by project representatives.

---

### 2. **Frontend / Backend** Display unclaimed CER projects
Public CER projects can be displayed in the system before they are claimed by a user.
An unclaimed project page may show:
- Official project name
- CER project ID
- Project proponent
- Project method
- Project type
- General location
- Registration information
- Project status
- Total ACCUs issued
- Total ACCUs relinquished
- Date the CER information was last updated
The page should clearly state:
> This project has not been claimed by a verified project representative.
Unclaimed projects should not display seller contact information, current ACCU availability, pricing, private documents, or seller-uploaded information.

---

### 3. **Frontend / Backend / Database** Allow users to claim a CER project
A registered user can request permission to manage a listing for an existing CER project.
The user selects the project and states their relationship to it, such as:
- Project owner
- Project proponent
- Authorised representative
- Project manager
- Project contributor
The claim request must record:
- The user who submitted the claim
- The CER project being claimed
- The claimed relationship
- The date the claim was submitted
- Supporting documents
- Verification status
- Reviewer
- Review notes
- Verification date
- Rejection reason
- Expiry or re-verification date
Possible claim statuses include:
- `pending`
- `additional_information_required`
- `approved`
- `rejected`
- `revoked`
- `expired`
A project and a listing are separate records.
A project is the official CER project.
A listing is the information managed by a verified user on the platform.
One CER project should normally have no more than one active verified listing unless several authorised parties are allowed to manage it.

---

### 4. **Backend / Database** Verify the user’s relationship to the project
The user uploads evidence showing that they are authorised to represent or contribute to the project.
The system does not collect private account information from the CER website.
Instead, users provide their own supporting documents, such as:
- Project ownership evidence
- Authority to represent the project
- Project participation agreements
- Organisation documents
- Registry exports
- Other supporting evidence
The uploaded documents are reviewed by an administrator.
The full documents should remain private and should only be visible to:
- The user who uploaded them
- Authorised administrators
- Other authorised reviewers
The public project page should only display the result of the verification, such as:
- Verified project representative
- Verification date
- Verification status
Private documents should not be publicly displayed.

---

### 5. **Frontend / Backend / Database** Create and manage a project listing
Once the user’s relationship to the project has been approved, the user can create and manage a listing connected to the official CER project.
The verified user may add information that is not supplied by the CER, including:
- Listing title
- Seller-written project description
- Project images
- Videos
- Project updates
- Environmental benefits
- Community benefits
- Contact information
- Current ACCU availability
- ACCU vintage
- ACCU category
- Indicative price
- Additional project documents
- More precise map information, where appropriate
The system must clearly separate:
- Official CER information
- Seller-provided information
- Platform verification information
Seller-provided information must not appear as though it was confirmed by the CER.

---

### 6. **Frontend / Backend / Database** Manage project images
Verified project representatives can upload their own project images.
Each image should record:
- The listing it belongs to
- The user who uploaded it
- File name
- Storage location
- File type
- File size
- Caption
- Alternative text
- Display order
- Whether it is the primary image
- Moderation status
- Upload date
Possible image statuses include:
- `pending`
- `approved`
- `rejected`
Users should confirm that they have permission to upload and display the images.
The system should not copy images from the CER website or another website unless it has permission to use them.
Projects without approved images may display:
- A project-type placeholder
- A map preview
- A licensed generic image
- No image

---

### 7. **Frontend / Backend / Database** Display project map locations
The system may display project locations on an interactive map.
Location information may come from:
- CER public data
- The project representative
- Automatic geocoding
- An administrator
The database should record the location source and its accuracy.
Possible location accuracy levels include:
- `state`
- `region`
- `approximate`
- `exact`
The database may store:
- State or territory
- Region
- Location name
- Latitude
- Longitude
- Optional project boundary data
- Location source
- Accuracy level
- Permission to display the location
If only a broad project location is publicly available, the map should show an approximate regional marker rather than an exact site.
Exact project locations should only be displayed when the project representative has permission to provide them.

---

### 8. **Frontend / Backend / Database** Upload ACCU certificates and evidence
Users upload their own ACCU certificates, holdings evidence, or related documents.
The system must not attempt to access private CER registry accounts or private ANREU holdings.
Uploaded evidence may include:
- ACCU certificates
- Holdings exports
- Registry statements
- Account evidence
- Ownership evidence
- Authority documents
- Other supporting documents
Each uploaded document should have a review status.
Possible statuses include:
- `pending`
- `under_review`
- `verified`
- `rejected`
- `expired`
The seller dashboard should display:
- Uploaded document
- Document type
- Review status
- Verification date
- Expiry date
- Reviewer notes
- Rejection reason
The full document should remain private.
The public listing should normally display only a verification summary, such as:
> ACCU evidence verified  
> Vintage: 2025  
> Verified quantity: 4,500 ACCUs  
> Verified on: 20 July 2026
A masked certificate or reference number may be displayed where appropriate.

---

### 9. **Backend** Separate project verification from ACCU verification
Project relationship verification and ACCU evidence verification are separate processes.
Project relationship verification confirms that the user is authorised to manage the project listing.
ACCU evidence verification confirms that uploaded documents support a stated ACCU quantity, vintage, category, or ownership claim.
A verified project representative should not automatically be treated as having verified ACCU holdings.
Each ACCU batch or availability claim may require separate evidence.

---

### 10. **Frontend / Backend / Database** Manage ACCU availability
Current ACCU availability is supplied by the verified project representative.
It should not be calculated from the total number of ACCUs issued by the CER.
The system must distinguish between:
- Total ACCUs issued for the project
- Total ACCUs relinquished
- ACCUs currently offered by the seller
Each availability record may include:
- Listing
- Quantity available
- Vintage
- ACCU category
- Indicative price
- Seller confirmation date
- Expiry date
- Notes
- Availability status
Possible availability statuses include:
- `active`
- `expired`
- `withdrawn`
- `sold_elsewhere`
- `pending_verification`
Seller-provided availability should expire after a set period unless the seller reconfirms it.
After expiry, the listing may display:
> Availability requires reconfirmation.
This prevents outdated quantities from remaining visible after ACCUs have been sold or transferred outside the platform.

---

### 11. **Frontend / Backend** Display verification and source information clearly
Every project page should clearly show where information came from.
For example:
| Information | Source |
|------------|--------|
| Project name | CER |
| CER project ID | CER |
| Project method | CER |
| Project status | CER |
| Total ACCUs issued | CER |
| Seller description | Project representative |
| Images | Project representative |
| Current ACCU availability | Project representative |
| Indicative price | Project representative |
| Verification status | Platform review |
| Map location | CER, seller, geocoding, or administrator |
The platform should show when CER data was last imported and when seller information was last confirmed.

---

### 12. **Frontend / Backend** Allow buyers to search and view projects
Buyers can search and filter projects using information stored in the platform.
Search and filter options may include:
- Project name
- Project type
- Project method
- State or territory
- Project status
- Verified listings only
- ACCU availability
- ACCU vintage
- ACCU category
- Price range
- Environmental benefits
- Community benefits
Buyers can view both unclaimed CER projects and verified seller listings.
Verified listings should display a clear verification badge.

---

### 13. **Frontend / Backend** Allow buyers to contact project representatives
The platform connects interested buyers with verified project representatives.
A buyer enquiry may include:
- Buyer
- Project listing
- Requested ACCU quantity
- Preferred vintage
- Preferred category
- Message
- Contact details
- Submission date
- Enquiry status
Possible enquiry statuses include:
- `new`
- `viewed`
- `responded`
- `closed`
- `withdrawn`
The platform does not process payments, complete purchases, or transfer ACCUs.
All negotiations, contracts, payments, registry checks, and ACCU transfers occur outside the platform.

---

### 14. **Backend / Database** Keep private information secure
The platform must not collect private information directly from restricted CER pages.
Private information supplied by users should be stored securely.
Private information may include:
- Full ANREU account references
- Registry statements
- Holdings evidence
- Ownership documents
- Authority documents
- Certificate files
- Reviewer notes
Public users should only see approved summaries or masked values.
For example:
> ANREU account reference: ••••••4821
Access to private documents should be restricted based on user roles and permissions.

---

### 15. **Backend / Database** Track CER imports and updates
The system should record every CER data import.
Each import record should include:
- Source name
- Source file or dataset
- Import start time
- Import completion time
- Import status
- Number of records received
- Number of projects inserted
- Number of projects updated
- Number of records that failed
- Error details
Possible import statuses include:
- `running`
- `completed`
- `completed_with_errors`
- `failed`
The system should match projects using the unique CER project ID.
New CER projects should be inserted.
Existing CER projects should be updated.
Unchanged projects should be skipped where possible.
CER imports must not delete or overwrite:
- Seller descriptions
- Seller images
- Seller documents
- Contact details
- ACCU availability
- Indicative prices
- Buyer enquiries
- Verification records

---

### 16. **Frontend / Backend / Database** Maintain listing and verification status
A project listing should have its own publication status.
Possible listing statuses include:
- `draft`
- `published`
- `paused`
- `archived`
A listing may only be publicly published when the project claim has been approved.
Verification may later be revoked or expire.
If verification is revoked or expires:
- The listing may be paused
- Seller contact options may be hidden
- Availability may be removed
- The project may return to an unclaimed state
- The user may be asked to submit updated evidence

---

### 17. **Frontend** Display platform disclaimers
Project pages should explain the limits of the platform.
A suitable disclaimer is:
> Official project information is sourced from public Clean Energy Regulator data. Listing descriptions, images, pricing and availability are supplied by the verified project representative. Platform verification is based on documents submitted by users and does not replace confirmation through the official CER registry. Purchases, payments and ACCU transfers occur outside this platform.

---

## Complete System Process
1. **Backend / Database** The system imports public CER project information.
2. **Database** Official CER projects are saved in the database.
3. **Frontend / Backend** Projects can appear publicly even when they have not been claimed.
4. **Frontend / Backend** A registered user requests to claim an existing CER project.
5. **Frontend / Backend / Database** The user states their relationship to the project.
6. **Frontend / Backend / Database** The user uploads supporting evidence.
7. **Backend** An administrator reviews the project claim.
8. **Backend / Database** The claim is approved, rejected, revoked, expired, or returned for more information.
9. **Frontend / Backend** An approved user creates and manages the project listing.
10. **Frontend / Backend / Database** The user uploads descriptions, images, documents and map information.
11. **Backend** Images and listing content may be reviewed before publication.
12. **Frontend / Backend / Database** The user uploads ACCU certificates or holdings evidence.
13. **Backend** ACCU evidence is reviewed separately from project ownership evidence.
14. **Frontend** Approved verification summaries are displayed on the listing.
15. **Frontend** Full private documents remain hidden from public users.
16. **Frontend / Backend / Database** The user enters current ACCU availability, vintage, category and indicative price.
17. **Backend / Database** Availability expires unless the user reconfirms it.
18. **Frontend** Buyers search, filter and view CER projects and verified listings.
19. **Frontend / Backend** Buyers submit enquiries to verified project representatives.
20. **Frontend / Backend** Buyers and project representatives continue discussions outside the platform.
21. **System (External)** Payments, purchases and ACCU transfers occur outside the platform.
22. **Backend / Database** The system regularly imports updated CER public data.
23. **Backend / Database** CER updates change only official CER fields.
24. **Backend / Database** Seller-managed information remains separate and is not overwritten.
25. **Frontend / Backend / Database** All information is labelled as CER-sourced, seller-provided, or platform-verified.


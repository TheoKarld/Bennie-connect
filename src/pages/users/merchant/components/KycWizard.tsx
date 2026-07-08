/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Merchant KYC wizard — ① business info → ② ID verification (type picker +
 * per-type format validation) → ③ private document upload (progress bars,
 * signed-URL preview) → ④ review & submit. Progress is draft-saved via
 * `POST /merchant/kyc` on every step advance, so the application is
 * multi-visit safe (merchant_panel.md §6.2).
 */

import React, { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Building2,
  IdCard,
  FileUp,
  ClipboardCheck,
  Check,
  Eye,
  Trash2,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import { Button, Field, Input, pushToast } from "../../../../components/ui";
import uploadService, {
  extractUploadError,
} from "../../../../services/upload.service";
import merchantService from "../../../../services/merchant.service";
import { useMerchantStore } from "../../../../store/merchantStore";
import type {
  KycDocLabel,
  MerchantIdType,
  MerchantKycPayload,
  MerchantMe,
} from "../../../../types/merchant";
import {
  CAC_PATTERN,
  ID_TYPE_OPTIONS,
  NG_PHONE_PATTERN,
  NIGERIAN_STATES,
  idTypeOption,
} from "./merchantMeta";

// --- Types ------------------------------------------------------------------------

interface DocState {
  fileId: string;
  originalName: string;
  /** True when this doc was staged server-side on a previous visit. */
  fromServer: boolean;
}

type DocMap = Partial<Record<KycDocLabel, DocState>>;

const STEPS = [
  { key: "business", label: "Business info", icon: Building2 },
  { key: "identity", label: "ID verification", icon: IdCard },
  { key: "documents", label: "Documents", icon: FileUp },
  { key: "review", label: "Review & submit", icon: ClipboardCheck },
] as const;

const DOC_SLOTS: { label: KycDocLabel; title: string; required: boolean; hint: string }[] = [
  {
    label: "ID_FRONT",
    title: "ID — front",
    required: true,
    hint: "A clear photo/scan of the front of your ID",
  },
  {
    label: "ID_BACK",
    title: "ID — back",
    required: false,
    hint: "Optional for single-sided documents",
  },
  {
    label: "SELFIE_WITH_ID",
    title: "Selfie with ID",
    required: true,
    hint: "Hold the ID beside your face",
  },
];

// --- Document slot -----------------------------------------------------------------

function DocSlot({
  slot,
  doc,
  onUploaded,
  onRemove,
  disabled,
}: {
  slot: (typeof DOC_SLOTS)[number];
  doc: DocState | undefined;
  onUploaded: (label: KycDocLabel, doc: DocState) => void;
  onRemove: (label: KycDocLabel) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const ok =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!ok) {
      pushToast({
        title: "Unsupported file",
        message: "Upload an image or PDF.",
        tone: "warning",
      });
      return;
    }
    setPercent(0);
    try {
      const meta = await uploadService.upload(file, {
        folder: "merchant/kyc",
        visibility: "private",
        onProgress: (p) => setPercent(p.percent),
      });
      onUploaded(slot.label, {
        fileId: meta.id,
        originalName: meta.originalName,
        fromServer: false,
      });
    } catch (err) {
      pushToast({
        title: "Upload failed",
        message: extractUploadError(err, "Could not upload this document."),
        tone: "alert",
      });
    } finally {
      setPercent(null);
    }
  };

  const preview = async () => {
    if (!doc) return;
    setPreviewing(true);
    try {
      // Server-staged docs are viewable only through the merchant signed-URL
      // route; freshly-uploaded ones through the upload signed-URL route.
      const res = doc.fromServer
        ? await merchantService.kycDocumentUrl(doc.fileId)
        : await uploadService.signedUrl(doc.fileId);
      window.open(res.url, "_blank", "noopener");
    } catch {
      pushToast({
        title: "Preview",
        message: "Could not open this document right now.",
        tone: "warning",
      });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">
            {slot.title}
            {slot.required && <span className="ml-1 text-danger">*</span>}
          </p>
          <p className="text-[11px] text-muted">{slot.hint}</p>
        </div>
        {doc && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {percent !== null ? (
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="font-mono text-[10px] font-bold text-primary">
            Uploading… {percent}%
          </p>
        </div>
      ) : doc ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <span className="min-w-0 truncate text-xs font-semibold text-ink">
            {doc.originalName || "Document"}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void preview()}
              disabled={previewing}
              aria-label="Preview document"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-primary/10 hover:text-primary disabled:opacity-40"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(slot.label)}
                aria-label="Remove document"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </div>
      ) : (
        !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            <FileUp className="h-4 w-4" /> Upload image or PDF
          </button>
        )
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// --- Wizard ---------------------------------------------------------------------------

export default function KycWizard({ me }: { me: MerchantMe }) {
  const reduce = useReducedMotion();
  const saveKyc = useMerchantStore((s) => s.saveKyc);
  const savingKyc = useMerchantStore((s) => s.savingKyc);

  const info = me.businessInfo;
  const isResubmit = me.status === "REJECTED";

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ① Business info.
  const [businessName, setBusinessName] = useState(info?.businessName ?? "");
  const [businessAddress, setBusinessAddress] = useState(
    info?.businessAddress ?? ""
  );
  const [state, setState] = useState(info?.state ?? "");
  const [lga, setLga] = useState(info?.lga ?? "");
  const [phoneNumber, setPhoneNumber] = useState(info?.phoneNumber ?? "");
  const [description, setDescription] = useState(info?.description ?? "");
  const [cacNumber, setCacNumber] = useState(info?.cacNumber ?? "");

  // ② Identity.
  const [idType, setIdType] = useState<MerchantIdType | "">(
    me.kyc?.idType ?? ""
  );
  const [idNumber, setIdNumber] = useState("");
  const savedIdMask = me.kyc?.idNumberMasked ?? null;

  // ③ Documents — seed from server-staged docs (draft saves persist them).
  const [docs, setDocs] = useState<DocMap>(() => {
    const initial: DocMap = {};
    for (const d of me.kyc?.documents ?? []) {
      if (d.label) {
        initial[d.label] = {
          fileId: d.fileId,
          originalName: d.originalName ?? "Document",
          fromServer: true,
        };
      }
    }
    return initial;
  });

  const [consent, setConsent] = useState(false);

  const idOpt = idTypeOption(idType || undefined);

  // --- Payload builders -----------------------------------------------------------

  const businessPayload = (): MerchantKycPayload["businessInfo"] => ({
    ...(businessName.trim() ? { businessName: businessName.trim() } : {}),
    ...(businessAddress.trim()
      ? { businessAddress: businessAddress.trim() }
      : {}),
    ...(state ? { state } : {}),
    ...(lga.trim() ? { lga: lga.trim() } : {}),
    ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
    ...(description.trim() ? { description: description.trim() } : {}),
    ...(cacNumber.trim() ? { cacNumber: cacNumber.trim().toUpperCase() } : {}),
  });

  const documentsPayload = () => {
    const list: { label: KycDocLabel; fileId: string }[] = [];
    for (const slot of DOC_SLOTS) {
      const doc = docs[slot.label];
      if (doc) list.push({ label: slot.label, fileId: doc.fileId });
    }
    return list;
  };

  const kycPayload = (): MerchantKycPayload["kyc"] => ({
    ...(idType ? { idType } : {}),
    ...(idNumber.trim() ? { idNumber: idNumber.trim() } : {}),
    ...(documentsPayload().length ? { documents: documentsPayload() } : {}),
  });

  // --- Validation -----------------------------------------------------------------

  const validateBusiness = (): boolean => {
    const next: Record<string, string> = {};
    if (businessName.trim().length < 3)
      next.businessName = "Business name must be at least 3 characters.";
    if (businessAddress.trim().length < 10)
      next.businessAddress = "Address must be at least 10 characters.";
    if (!state) next.state = "Select your state.";
    if (!NG_PHONE_PATTERN.test(phoneNumber.trim()))
      next.phoneNumber =
        "Enter a valid Nigerian mobile number (+234… or 0…).";
    if (cacNumber.trim() && !CAC_PATTERN.test(cacNumber.trim()))
      next.cacNumber = "CAC number is RC/BN followed by 5–8 digits.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const idNumberSatisfied = Boolean(idNumber.trim()) || Boolean(savedIdMask);

  const validateIdentity = (): boolean => {
    const next: Record<string, string> = {};
    if (!idType) next.idType = "Choose an ID type.";
    if (idNumber.trim()) {
      if (idOpt && !idOpt.pattern.test(idNumber.trim()))
        next.idNumber = `Invalid format — ${idOpt.hint}.`;
    } else if (!savedIdMask) {
      next.idNumber = "Enter your ID number.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateDocuments = (): boolean => {
    const next: Record<string, string> = {};
    for (const slot of DOC_SLOTS) {
      if (slot.required && !docs[slot.label]) {
        next[slot.label] = `${slot.title} is required.`;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      pushToast({
        title: "Documents",
        message: "Upload the required documents to continue.",
        tone: "warning",
      });
      return false;
    }
    return true;
  };

  // --- Step navigation (draft-save on advance) ------------------------------------------

  const draftSave = async (payload: MerchantKycPayload) => {
    try {
      await saveKyc({ ...payload, submit: false });
      return true;
    } catch (err) {
      pushToast({
        title: "Save failed",
        message: (err as Error)?.message || "Could not save your progress.",
        tone: "alert",
      });
      return false;
    }
  };

  const nextStep = async () => {
    setErrors({});
    if (step === 0) {
      if (!validateBusiness()) return;
      if (!(await draftSave({ businessInfo: businessPayload() }))) return;
    } else if (step === 1) {
      if (!validateIdentity()) return;
      if (!(await draftSave({ kyc: kycPayload() }))) return;
    } else if (step === 2) {
      if (!validateDocuments()) return;
      if (!(await draftSave({ kyc: kycPayload() }))) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!consent) {
      pushToast({
        title: "Consent required",
        message: "Please accept the verification consent to submit.",
        tone: "warning",
      });
      return;
    }
    try {
      await saveKyc({
        submit: true,
        businessInfo: businessPayload(),
        kyc: kycPayload(),
      });
      pushToast({
        title: "Application submitted",
        message: "Your merchant application is now under review.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Submission failed",
        message: (err as Error)?.message || "Could not submit your application.",
        tone: "alert",
      });
    }
  };

  // --- Review summary rows -------------------------------------------------------------

  const reviewRows = useMemo(
    () => [
      { label: "Business name", value: businessName || "—" },
      { label: "Address", value: businessAddress || "—" },
      {
        label: "Location",
        value: [lga, state].filter(Boolean).join(", ") || "—",
      },
      { label: "Phone", value: phoneNumber || "—" },
      { label: "CAC number", value: cacNumber || "Not registered" },
      {
        label: "ID type",
        value: idOpt?.label ?? "—",
      },
      {
        label: "ID number",
        value: idNumber
          ? `••••••${idNumber.slice(-4)}`
          : (savedIdMask ?? "—"),
      },
      {
        label: "Documents",
        value:
          documentsPayload()
            .map((d) => d.label.replaceAll("_", " ").toLowerCase())
            .join(", ") || "—",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      businessName,
      businessAddress,
      lga,
      state,
      phoneNumber,
      cacNumber,
      idOpt,
      idNumber,
      savedIdMask,
      docs,
    ]
  );

  const inputCls = (invalid?: boolean) =>
    `w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-ink transition focus:outline-none focus:ring-2 ${
      invalid
        ? "border-danger/60 focus:ring-danger/25"
        : "border-border focus:border-primary focus:ring-primary/15"
    }`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isResubmit && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
          <p className="font-bold">Resubmitting your application</p>
          <p className="mt-1 text-xs">
            Your previous documents were deleted after review — please upload
            fresh copies before submitting again.
          </p>
          {me.rejectionReason && (
            <p className="mt-2 rounded-xl bg-amber-100/70 px-3 py-2 text-xs dark:bg-amber-400/10">
              Reviewer note: {me.rejectionReason}
            </p>
          )}
        </div>
      )}

      {/* Step header */}
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  done
                    ? "border-primary bg-primary text-white"
                    : active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={`hidden text-center text-[10px] font-bold uppercase tracking-wider sm:block ${
                  active || done ? "text-ink" : "text-muted"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <motion.div
        key={step}
        initial={reduce ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-3xl border border-border bg-surface p-5 sm:p-7"
      >
        {/* ① Business info */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-ink">
              Tell us about your business
            </h2>
            <Field label="Business name" error={errors.businessName}>
              <Input
                value={businessName}
                invalid={Boolean(errors.businessName)}
                onChange={(e) => setBusinessName(e.target.value.slice(0, 80))}
                placeholder="e.g. Shola Organic Farms"
              />
            </Field>
            <Field label="Business address" error={errors.businessAddress}>
              <Input
                value={businessAddress}
                invalid={Boolean(errors.businessAddress)}
                onChange={(e) =>
                  setBusinessAddress(e.target.value.slice(0, 200))
                }
                placeholder="Street address"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="State" error={errors.state}>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={inputCls(Boolean(errors.state))}
                >
                  <option value="">Select state…</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="LGA (optional)">
                <Input
                  value={lga}
                  onChange={(e) => setLga(e.target.value.slice(0, 60))}
                  placeholder="Local government area"
                />
              </Field>
            </div>
            <Field label="Phone number" error={errors.phoneNumber}>
              <Input
                value={phoneNumber}
                invalid={Boolean(errors.phoneNumber)}
                onChange={(e) => setPhoneNumber(e.target.value.slice(0, 14))}
                placeholder="+2348012345678"
                inputMode="tel"
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="What do you sell?"
                className={`${inputCls(false)} resize-none`}
              />
            </Field>
            <Field
              label="CAC / RC number (optional)"
              hint="For registered businesses — RC or BN followed by digits"
              error={errors.cacNumber}
            >
              <Input
                value={cacNumber}
                invalid={Boolean(errors.cacNumber)}
                onChange={(e) => setCacNumber(e.target.value.slice(0, 10))}
                placeholder="RC1234567"
              />
            </Field>
          </div>
        )}

        {/* ② Identity */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Verify your identity
            </h2>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                ID type
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ID_TYPE_OPTIONS.map((opt) => {
                  const active = idType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setIdType(opt.value);
                        setErrors((e) => ({ ...e, idType: "" }));
                      }}
                      className={`rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface hover:border-primary/25"
                      }`}
                    >
                      <span
                        className={`block text-sm font-semibold ${
                          active ? "text-primary" : "text-ink"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.idType && (
                <p className="mt-1.5 text-xs font-medium text-danger">
                  {errors.idType}
                </p>
              )}
            </div>

            <Field
              label="ID number"
              hint={
                idOpt
                  ? idOpt.hint
                  : "Choose an ID type to see the expected format"
              }
              error={errors.idNumber}
            >
              <Input
                value={idNumber}
                invalid={Boolean(errors.idNumber)}
                onChange={(e) => setIdNumber(e.target.value.slice(0, 30))}
                placeholder={
                  savedIdMask ? `Saved: ${savedIdMask}` : "Enter your ID number"
                }
                inputMode={idOpt?.inputMode === "numeric" ? "numeric" : "text"}
              />
            </Field>
            {savedIdMask && !idNumber && (
              <p className="text-[11px] text-muted">
                An ID number is already saved ({savedIdMask}). Leave the field
                blank to keep it, or enter a new one to replace it.
              </p>
            )}

            <div className="flex items-start gap-2.5 rounded-2xl bg-primary/5 p-4 text-xs text-primary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Your ID number is checked against the official identity registry
              and is always masked after submission.
            </div>
          </div>
        )}

        {/* ③ Documents */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-ink">
              Upload your documents
            </h2>
            <p className="text-xs text-muted">
              Documents are stored privately, viewed only by reviewers via
              expiring links, and permanently deleted after the decision.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DOC_SLOTS.map((slot) => (
                <div key={slot.label}>
                  <DocSlot
                    slot={slot}
                    doc={docs[slot.label]}
                    disabled={savingKyc}
                    onUploaded={(label, doc) => {
                      setDocs((prev) => ({ ...prev, [label]: doc }));
                      setErrors((e) => ({ ...e, [label]: "" }));
                    }}
                    onRemove={(label) =>
                      setDocs((prev) => {
                        const next = { ...prev };
                        delete next[label];
                        return next;
                      })
                    }
                  />
                  {errors[slot.label] && (
                    <p className="mt-1 text-xs font-medium text-danger">
                      {errors[slot.label]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ④ Review */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Review &amp; submit
            </h2>
            <dl className="divide-y divide-border rounded-2xl border border-border">
              {reviewRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {row.label}
                  </dt>
                  <dd className="max-w-[60%] text-right text-sm font-semibold text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-2/60 p-4">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-xs leading-relaxed text-muted">
                I consent to my identity being verified against official
                records. I understand my uploaded documents will be reviewed by
                the cooperative and{" "}
                <span className="font-semibold text-ink">
                  permanently deleted after the decision
                </span>
                , whether approved or rejected.
              </span>
            </label>
          </div>
        )}

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          <Button
            variant="ghost"
            disabled={step === 0 || savingKyc}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button loading={savingKyc} onClick={() => void nextStep()}>
              Save &amp; continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button loading={savingKyc} onClick={() => void submit()}>
              <ShieldCheck className="h-4 w-4" /> Submit application
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
